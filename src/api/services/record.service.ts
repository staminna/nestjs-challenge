import { Injectable, Logger, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Record } from '../schemas/record.schema';
import { RecordCategory, RecordFormat } from '../schemas/record.enum';
import { CreateRecordRequestDTO } from '../dtos/create-record.request.dto';
import { UpdateRecordRequestDTO } from '../dtos/update-record.request.dto';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import * as xml2js from 'xml2js';

@Injectable()
export class RecordService {
  private readonly logger = new Logger(RecordService.name);
  private readonly MUSICBRAINZ_API_BASE = 'http://musicbrainz.org/ws/2';
  private readonly USER_AGENT = 'RecordStore/1.0.0 (contact@example.com)';

  constructor(
    @InjectModel('Record') private readonly recordModel: Model<Record>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async create(createRecordDto: CreateRecordRequestDTO): Promise<Record> {
    // If MBID is provided, try to get album details from MusicBrainz
    if (createRecordDto.mbid) {
      try {
        const mbData = await this.fetchMusicBrainzData(createRecordDto.mbid);
        if (mbData) {
          // Merge MusicBrainz data with the DTO data
          Object.assign(createRecordDto, mbData);
        }
      } catch (error) {
        this.logger.error(`Error fetching MusicBrainz data: ${error.message}`);
        // Continue with creation even if MusicBrainz fetch fails
      }
    }

    // Invalidate relevant cache keys when creating a new record
    await this.cacheManager.reset();
    
    return await this.recordModel.create(createRecordDto);
  }

  async update(id: string, updateRecordDto: UpdateRecordRequestDTO): Promise<Record> {
    // If MBID is provided, check if it's different from the current one
    if (updateRecordDto.mbid) {
      const currentRecord = await this.recordModel.findById(id).lean().exec();
      if (currentRecord && currentRecord.mbid !== updateRecordDto.mbid) {
        try {
          const mbData = await this.fetchMusicBrainzData(updateRecordDto.mbid);
          if (mbData) {
            // Merge MusicBrainz data with the DTO data
            Object.assign(updateRecordDto, mbData);
          }
        } catch (error) {
          this.logger.error(`Error fetching MusicBrainz data: ${error.message}`);
          // Continue with update even if MusicBrainz fetch fails
        }
      }
    }

    // Invalidate relevant cache keys when updating a record
    await this.cacheManager.del(`record:${id}`);
    await this.cacheManager.reset();

    return await this.recordModel.findByIdAndUpdate(
      id,
      { ...updateRecordDto, lastModified: new Date() },
      { new: true }
    );
  }

  async findOne(id: string): Promise<Record> {
    // Try to get from cache first
    const cacheKey = `record:${id}`;
    const cachedRecord = await this.cacheManager.get<Record>(cacheKey);
    
    if (cachedRecord) {
      this.logger.log(`Cache hit for record ${id}`);
      return cachedRecord;
    }

    // If not in cache, get from database and store in cache
    const record = await this.recordModel.findById(id).lean().exec();
    
    if (record) {
      await this.cacheManager.set(cacheKey, record, 60 * 5); // Cache for 5 minutes
    }
    
    return record;
  }

  async findAll(
    q?: string,
    artist?: string,
    album?: string,
    format?: RecordFormat,
    category?: RecordCategory,
    page = 1,
    limit = 20,
    fields?: string,
  ): Promise<{ records: Record[]; total: number; page: number; totalPages: number }> {
    // Generate a cache key based on query parameters
    const cacheKey = `records:${q || ''}:${artist || ''}:${album || ''}:${format || ''}:${category || ''}:${page}:${limit}:${fields || ''}`;
    
    // Try to get from cache first
    const cachedResult = await this.cacheManager.get(cacheKey);
    if (cachedResult) {
      this.logger.log(`Cache hit for query ${cacheKey}`);
      return cachedResult as any;
    }

    const skip = (page - 1) * limit;
    const query: any = {};

    // Build query filters using MongoDB syntax instead of in-memory filtering
    if (q) {
      query.$or = [
        { artist: { $regex: q, $options: 'i' } },
        { album: { $regex: q, $options: 'i' } },
        { category: { $regex: q, $options: 'i' } },
      ];
    }

    if (artist) {
      query.artist = { $regex: artist, $options: 'i' };
    }

    if (album) {
      query.album = { $regex: album, $options: 'i' };
    }

    if (format) {
      query.format = format;
    }

    if (category) {
      query.category = category;
    }

    // Create text index for more performant full-text search if it doesn't exist
    try {
      const indexExists = await this.recordModel.collection.indexExists('textIndex');
      if (!indexExists) {
        await this.recordModel.collection.createIndex(
          { artist: 'text', album: 'text', category: 'text' },
          { name: 'textIndex' }
        );
      }
    } catch (error) {
      this.logger.error(`Error creating text index: ${error.message}`);
    }

    // Parse fields for projection to reduce data transfer
    let projection = {};
    if (fields) {
      projection = fields.split(',').reduce((acc, field) => {
        acc[field.trim()] = 1;
        return acc;
      }, {});
    }

    // Execute the optimized query with projection and lean() for better performance
    try {
      // Use Promise.all to run queries in parallel
      const [records, total] = await Promise.all([
        this.recordModel.find(query, projection)
          .lean()  // Convert Mongoose docs to plain objects (much faster, less memory)
          .skip(skip)
          .limit(limit)
          .exec(),
        this.recordModel.countDocuments(query).exec(),
      ]);

      const result = {
        records,
        total,
        page,
        totalPages: Math.ceil(total / limit),
      };

      // Store in cache for 1 minute (adjust as needed)
      await this.cacheManager.set(cacheKey, result, 60);

      return result;
    } catch (error) {
      this.logger.error(`Error executing find query: ${error.message}`);
      throw error;
    }
  }

  async findByMBID(mbid: string): Promise<Record> {
    // Try to get from cache first
    const cacheKey = `record:mbid:${mbid}`;
    const cachedRecord = await this.cacheManager.get<Record>(cacheKey);
    
    if (cachedRecord) {
      this.logger.log(`Cache hit for MBID ${mbid}`);
      return cachedRecord;
    }

    // If not in cache, get from database and store in cache
    const record = await this.recordModel.findOne({ mbid }).lean().exec();
    
    if (record) {
      await this.cacheManager.set(cacheKey, record, 60 * 5); // Cache for 5 minutes
    }
    
    return record;
  }

  async fetchMusicBrainzDataPublic(mbid: string): Promise<any> {
    // This is a public wrapper around the private fetchMusicBrainzData method
    return this.fetchMusicBrainzData(mbid);
  }

  async delete(id: string): Promise<void> {
    await this.recordModel.findByIdAndDelete(id).exec();
    
    // Invalidate cache when deleting a record
    await this.cacheManager.del(`record:${id}`);
    await this.cacheManager.reset();
  }

  // MusicBrainz integration
  private async fetchMusicBrainzData(mbid: string): Promise<any> {
    // Try to get from cache first to reduce API calls
    const cacheKey = `musicbrainz:${mbid}`;
    const cachedData = await this.cacheManager.get(cacheKey);
    
    if (cachedData) {
      this.logger.log(`Cache hit for MusicBrainz data ${mbid}`);
      return cachedData;
    }

    try {
      // MusicBrainz API has rate limiting, so we need to be careful with requests
      // Add a delay to avoid being blocked
      await this.delay(1000);
      
      // Changed to XML format as specified in the requirements
      const url = `${this.MUSICBRAINZ_API_BASE}/release/${mbid}?inc=recordings+artists+release-groups+labels+media`;
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': this.USER_AGENT,
          'Accept': 'application/xml',
        },
      });
      
      if (!response.ok) {
        throw new Error(`MusicBrainz API responded with status: ${response.status}`);
      }
      
      const xmlText = await response.text();
      
      // Parse XML using xml2js
      const parser = new xml2js.Parser({ explicitArray: false, mergeAttrs: true });
      const result = await this.parseXmlAndExtractData(parser, xmlText);

      // Cache the MusicBrainz data for a day since it rarely changes
      await this.cacheManager.set(cacheKey, result, 60 * 60 * 24);
      
      return result;
    } catch (error) {
      this.logger.error(`Error fetching from MusicBrainz: ${error.message}`);
      return null;
    }
  }

  private async parseXmlAndExtractData(parser: xml2js.Parser, xmlText: string): Promise<any> {
    try {
      const parsedXml = await parser.parseStringPromise(xmlText);
      
      // Extract data from parsed XML
      const release = parsedXml.metadata?.release;
      if (!release) {
        throw new Error('No release data found in MusicBrainz response');
      }
      
      // Extract title (album name)
      const title = release.title || '';
      
      // Extract artist
      let artist = '';
      if (release['artist-credit'] && release['artist-credit']['name-credit']) {
        const nameCredit = Array.isArray(release['artist-credit']['name-credit']) 
          ? release['artist-credit']['name-credit'][0] 
          : release['artist-credit']['name-credit'];
          
        artist = nameCredit.artist?.name || '';
      }
      
      // Extract track list
      let trackList = [];
      if (release.media) {
        const media = Array.isArray(release.media) ? release.media[0] : release.media;
        if (media && media['track-list'] && media['track-list'].track) {
          const tracks = Array.isArray(media['track-list'].track) 
            ? media['track-list'].track 
            : [media['track-list'].track];
            
          trackList = tracks.map(track => {
            return {
              title: track.recording?.title || track.title || '',
              position: track.position || '',
              duration: track.length ? parseInt(track.length, 10) : 0,
            };
          });
        }
      }
      
      this.logger.log(`Successfully extracted ${trackList.length} tracks from MusicBrainz`);
      
      // Return extracted data
      return {
        ...(artist && { artist }),
        ...(title && { album: title }),
        trackList,
      };
    } catch (error) {
      this.logger.error(`Error parsing MusicBrainz XML: ${error.message}`);
      return null;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

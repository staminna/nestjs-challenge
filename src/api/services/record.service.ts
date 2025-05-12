import { Injectable, Logger, Inject, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Record } from '../schemas/record.schema';
import { RecordCategory, RecordFormat } from '../schemas/record.enum';
import { CreateRecordRequestDTO } from '../dtos/create-record.request.dto';
import { UpdateRecordRequestDTO } from '../dtos/update-record.request.dto';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import * as xml2js from 'xml2js';
import * as path from 'path';
import * as fs from 'fs';
import { HttpService } from '@nestjs/axios';

@Injectable()
export class RecordService {
  private readonly logger = new Logger(RecordService.name);
  private readonly MUSICBRAINZ_API_BASE = 'http://musicbrainz.org/ws/2';
  private readonly USER_AGENT = 'RecordStore/1.0.0 (contact@example.com)';
  // Cache keys prefix for easier management
  private readonly CACHE_PREFIX = {
    RECORD: 'record:',
    RECORDS: 'records:',
    MUSICBRAINZ: 'musicbrainz:',
  };

  constructor(
    @InjectModel('Record') private readonly recordModel: Model<Record>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly httpService: HttpService,
  ) {}

  async create(createRecordDto: CreateRecordRequestDTO): Promise<Record> {
    // Check for existing record with same title and artist
    const existingRecord = await this.recordModel
      .findOne({
        title: createRecordDto.album,
        artist: createRecordDto.artist,
      })
      .exec();

    if (existingRecord) {
      throw new ConflictException(
        'A record with this title and artist already exists',
      );
    }

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

    // Instead of resetting the entire cache, just clear the records list cache
    await this.cacheManager.del(this.CACHE_PREFIX.RECORDS);

    return await this.recordModel.create({
      ...createRecordDto,
      isUserCreated: true, // Mark as user-created
    });
  }

  async update(
    id: string,
    updateRecordDto: UpdateRecordRequestDTO,
  ): Promise<Record> {
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
          this.logger.error(
            `Error fetching MusicBrainz data: ${error.message}`,
          );
          // Continue with update even if MusicBrainz fetch fails
        }
      }
    }

    // Clear specific cache keys rather than using reset()
    const recordKey = `${this.CACHE_PREFIX.RECORD}${id}`;
    await this.cacheManager.del(recordKey);
    await this.cacheManager.del(this.CACHE_PREFIX.RECORDS);

    // If MBID exists, also clear the MBID-based cache
    if (updateRecordDto.mbid) {
      await this.cacheManager.del(
        `${this.CACHE_PREFIX.RECORD}mbid:${updateRecordDto.mbid}`,
      );
    }

    return await this.recordModel.findByIdAndUpdate(
      id,
      { ...updateRecordDto, lastModified: new Date() },
      { new: true },
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
  ): Promise<{
    records: Record[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    // No filters by default - show all records
    const query: any = {};

    // Generate a cache key based on query parameters
    const cacheKey = `records:${q || ''}:${artist || ''}:${album || ''}:${format || ''}:${category || ''}:${page}:${limit}:${fields || ''}`;

    // Try to get from cache first - but disable for debugging
    // const cachedResult = await this.cacheManager.get(cacheKey);
    // if (cachedResult) {
    //   this.logger.log(`Cache hit for query ${cacheKey}`);
    //   return cachedResult as any;
    // }

    const skip = (page - 1) * limit;

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
      this.logger.log(`Executing query: ${JSON.stringify(query)}`);

      // Use Promise.all to run queries in parallel
      const [records, total] = await Promise.all([
        this.recordModel
          .find(query, projection)
          .lean() // Convert Mongoose docs to plain objects (much faster, less memory)
          .skip(skip)
          .limit(limit)
          .exec(),
        this.recordModel.countDocuments(query).exec(),
      ]);

      this.logger.log(`Found ${records.length} records out of ${total} total`);

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
    const record = await this.recordModel.findById(id).lean().exec();
    await this.recordModel.findByIdAndDelete(id).exec();

    // Clear specific cache entries instead of using reset()
    await this.cacheManager.del(`${this.CACHE_PREFIX.RECORD}${id}`);
    await this.cacheManager.del(this.CACHE_PREFIX.RECORDS);

    // If record has an MBID, also clear that cache
    if (record?.mbid) {
      await this.cacheManager.del(
        `${this.CACHE_PREFIX.RECORD}mbid:${record.mbid}`,
      );
    }
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
          Accept: 'application/xml',
        },
      });

      if (!response.ok) {
        throw new Error(
          `MusicBrainz API responded with status: ${response.status}`,
        );
      }

      const xmlText = await response.text();

      // Parse XML using xml2js
      const parser = new xml2js.Parser({
        explicitArray: false,
        mergeAttrs: true,
      });
      const result = await this.parseXmlAndExtractData(parser, xmlText);

      // Cache the MusicBrainz data for a day since it rarely changes
      await this.cacheManager.set(cacheKey, result, 60 * 60 * 24);

      return result;
    } catch (error) {
      this.logger.error(`Error fetching from MusicBrainz: ${error.message}`);
      return null;
    }
  }

  private async parseXmlAndExtractData(
    parser: xml2js.Parser,
    xmlText: string,
  ): Promise<any> {
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
        const nameCredit = Array.isArray(
          release['artist-credit']['name-credit'],
        )
          ? release['artist-credit']['name-credit'][0]
          : release['artist-credit']['name-credit'];

        artist = nameCredit.artist?.name || '';
      }

      // Extract track list
      let trackList = [];
      if (release.media) {
        const media = Array.isArray(release.media)
          ? release.media[0]
          : release.media;
        if (media && media['track-list'] && media['track-list'].track) {
          const tracks = Array.isArray(media['track-list'].track)
            ? media['track-list'].track
            : [media['track-list'].track];

          trackList = tracks.map((track) => {
            return {
              title: track.recording?.title || track.title || '',
              position: track.position || '',
              duration: track.length ? parseInt(track.length, 10) : 0,
            };
          });
        }
      }

      this.logger.log(
        `Successfully extracted ${trackList.length} tracks from MusicBrainz`,
      );

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
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async createTextIndex() {
    try {
      this.logger.log('Text indexes are defined at schema level');
    } catch (error) {
      this.logger.error(`Error with text index: ${error.message}`);
    }
  }

  async findAllNoPagination() {
    return this.recordModel.find().lean().exec();
  }

  async seedFromJson(): Promise<Record[]> {
    try {
      const dataPath = path.join(__dirname, '../../../data.json');
      this.logger.log(`Loading seed data from: ${dataPath}`);

      // Check if file exists
      if (!fs.existsSync(dataPath)) {
        this.logger.error(`Seed file not found at: ${dataPath}`);
        throw new Error(`Seed file not found at: ${dataPath}`);
      }

      const raw = fs.readFileSync(dataPath, 'utf-8');
      const records = JSON.parse(raw);

      this.logger.log(`Loaded ${records.length} records from seed file`);

      // Mark all records as non-user created
      const recordsWithFlag = records.map((record) => ({
        ...record,
        isUserCreated: false,
      }));

      // Insert records but ignore duplicates
      const insertedRecords = await this.recordModel
        .insertMany(recordsWithFlag, {
          ordered: false, // Continue processing even if some documents fail
        })
        .catch((err) => {
          // Handle duplicate key errors and return already inserted records
          if (err.code === 11000) {
            this.logger.warn(
              'Some records were already in the database and were skipped',
            );
            return err.insertedDocs || [];
          }
          throw err;
        });

      // Clear the cache
      await this.cacheManager.del(this.CACHE_PREFIX.RECORDS);

      this.logger.log(
        `Seeded ${insertedRecords.length} records from data.json`,
      );
      return insertedRecords;
    } catch (error) {
      this.logger.error(`Error seeding records: ${error.message}`);
      throw error;
    }
  }

  // Add this new method to search for artists by name
  async searchMusicBrainzArtists(query: string): Promise<any[]> {
    if (!query || query.trim().length < 2) {
      return [];
    }

    const cacheKey = `${this.CACHE_PREFIX.MUSICBRAINZ}search:artist:${query}`;
    const cachedResults = await this.cacheManager.get(cacheKey);

    if (cachedResults) {
      this.logger.log(`Cache hit for artist search: ${query}`);
      return cachedResults as any[];
    }

    try {
      // Add delay to respect MusicBrainz rate limiting
      await this.delay(1000);

      // Encode the query parameter to handle special characters
      const encodedQuery = encodeURIComponent(query);
      const url = `${this.MUSICBRAINZ_API_BASE}/artist?query=${encodedQuery}&limit=10&fmt=json`;

      this.logger.log(`Searching MusicBrainz for artists matching: ${query}`);

      const response = await fetch(url, {
        headers: {
          'User-Agent': this.USER_AGENT,
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(
          `MusicBrainz API responded with status: ${response.status}`,
        );
      }

      const data = await response.json();

      // Extract and format the artist data
      const artists =
        data.artists?.map((artist) => ({
          id: artist.id,
          name: artist.name,
          type: artist.type,
          country: artist.country,
          score: artist.score,
          disambiguation: artist.disambiguation,
        })) || [];

      // Sort by score (relevance)
      artists.sort((a, b) => b.score - a.score);

      // Cache the results for 1 hour
      await this.cacheManager.set(cacheKey, artists, 60 * 60);

      return artists;
    } catch (error) {
      this.logger.error(
        `Error searching MusicBrainz artists: ${error.message}`,
      );
      return [];
    }
  }

  // Add this method to search for releases (albums) by artist ID
  async searchMusicBrainzReleases(artistId: string): Promise<any[]> {
    if (!artistId) {
      return [];
    }

    const cacheKey = `${this.CACHE_PREFIX.MUSICBRAINZ}releases:artist:${artistId}`;
    const cachedResults = await this.cacheManager.get(cacheKey);

    if (cachedResults) {
      this.logger.log(`Cache hit for artist releases: ${artistId}`);
      return cachedResults as any[];
    }

    try {
      // Add delay to respect MusicBrainz rate limiting
      await this.delay(1000);

      const url = `${this.MUSICBRAINZ_API_BASE}/release?artist=${artistId}&limit=25&fmt=json`;

      this.logger.log(`Fetching releases for artist ID: ${artistId}`);

      const response = await fetch(url, {
        headers: {
          'User-Agent': this.USER_AGENT,
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(
          `MusicBrainz API responded with status: ${response.status}`,
        );
      }

      const data = await response.json();

      // Extract and format the release data
      const releases =
        data.releases?.map((release) => ({
          id: release.id,
          title: release.title,
          status: release.status,
          date: release.date,
          country: release.country,
          trackCount: release['track-count'],
          disambiguation: release.disambiguation,
        })) || [];

      // Cache the results for 1 day
      await this.cacheManager.set(cacheKey, releases, 60 * 60 * 24);

      return releases;
    } catch (error) {
      this.logger.error(
        `Error fetching MusicBrainz releases: ${error.message}`,
      );
      return [];
    }
  }

  async getReleaseAsXML(mbid: string): Promise<string> {
    if (!mbid) {
      throw new Error('MBID is required');
    }

    const cacheKey = `${this.CACHE_PREFIX.MUSICBRAINZ}xml:${mbid}`;
    const cachedXml = await this.cacheManager.get<string>(cacheKey);

    if (cachedXml) {
      this.logger.log(`Cache hit for XML data: ${mbid}`);
      return cachedXml;
    }

    try {
      // Add delay to respect MusicBrainz rate limiting
      await this.delay(1000);

      const url = `${this.MUSICBRAINZ_API_BASE}/release/${mbid}?inc=recordings+artists+release-groups+labels+media`;

      this.logger.log(`Fetching XML for release ${mbid}`);

      const response = await fetch(url, {
        headers: {
          'User-Agent': this.USER_AGENT,
          Accept: 'application/xml',
        },
      });

      if (!response.ok) {
        throw new Error(
          `MusicBrainz API responded with status: ${response.status}`,
        );
      }

      const xmlText = await response.text();

      // Cache the raw XML for 1 day
      await this.cacheManager.set(cacheKey, xmlText, 60 * 60 * 24);

      return xmlText;
    } catch (error) {
      this.logger.error(`Error fetching XML for release: ${error.message}`);
      throw error;
    }
  }
}

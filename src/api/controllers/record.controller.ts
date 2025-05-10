import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Put,
  Delete,
  NotFoundException,
  InternalServerErrorException,
  HttpCode,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiParam } from '@nestjs/swagger';
import { RecordService } from '../services/record.service';
import { CreateRecordRequestDTO } from '../dtos/create-record.request.dto';
import { UpdateRecordRequestDTO } from '../dtos/update-record.request.dto';
import { RecordCategory, RecordFormat } from '../schemas/record.enum';
import { Record } from '../schemas/record.schema';

@Controller('records')
export class RecordController {
  constructor(private readonly recordService: RecordService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new record' })
  @ApiResponse({ status: 201, description: 'Record successfully created' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  async create(@Body() request: CreateRecordRequestDTO): Promise<Record> {
    return await this.recordService.create(request);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update an existing record' })
  @ApiResponse({ status: 200, description: 'Record updated successfully' })
  @ApiResponse({ status: 404, description: 'Record not found' })
  @ApiResponse({ status: 500, description: 'Internal Server Error' })
  @ApiParam({ name: 'id', description: 'Record ID' })
  async update(
    @Param('id') id: string,
    @Body() updateRecordDto: UpdateRecordRequestDTO,
  ): Promise<Record> {
    const updatedRecord = await this.recordService.update(id, updateRecordDto);
    if (!updatedRecord) {
      throw new NotFoundException('Record not found');
    }
    return updatedRecord;
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a record by ID' })
  @ApiResponse({ status: 200, description: 'Record found' })
  @ApiResponse({ status: 404, description: 'Record not found' })
  @ApiParam({ name: 'id', description: 'Record ID' })
  async findOne(@Param('id') id: string): Promise<Record> {
    const record = await this.recordService.findOne(id);
    if (!record) {
      throw new NotFoundException('Record not found');
    }
    return record;
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a record by ID' })
  @ApiResponse({ status: 204, description: 'Record deleted successfully' })
  @ApiResponse({ status: 404, description: 'Record not found' })
  @ApiParam({ name: 'id', description: 'Record ID' })
  async delete(@Param('id') id: string): Promise<void> {
    const record = await this.recordService.findOne(id);
    if (!record) {
      throw new NotFoundException('Record not found');
    }
    await this.recordService.delete(id);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all records with optional filters and pagination',
  })
  @ApiResponse({
    status: 200,
    description: 'List of records',
  })
  @ApiQuery({
    name: 'q',
    required: false,
    description:
      'Search query (search across multiple fields like artist, album, category, etc.)',
    type: String,
  })
  @ApiQuery({
    name: 'artist',
    required: false,
    description: 'Filter by artist name',
    type: String,
  })
  @ApiQuery({
    name: 'album',
    required: false,
    description: 'Filter by album name',
    type: String,
  })
  @ApiQuery({
    name: 'format',
    required: false,
    description: 'Filter by record format (Vinyl, CD, etc.)',
    enum: RecordFormat,
    type: String,
  })
  @ApiQuery({
    name: 'category',
    required: false,
    description: 'Filter by record category (e.g., Rock, Jazz)',
    enum: RecordCategory,
    type: String,
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number for pagination (default: 1)',
    type: Number,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Number of records per page (default: 20, max: 100)',
    type: Number,
  })
  @ApiQuery({
    name: 'fields',
    required: false,
    description:
      'Comma-separated list of fields to include (e.g., artist,album,price)',
    type: String,
  })
  async findAll(
    @Query('q') q?: string,
    @Query('artist') artist?: string,
    @Query('album') album?: string,
    @Query('format') format?: RecordFormat,
    @Query('category') category?: RecordCategory,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('fields') fields?: string,
  ) {
    // Validate and sanitize pagination parameters
    const pageNum = page ? Math.max(1, parseInt(page.toString())) : 1;
    const limitNum = limit
      ? Math.min(100, Math.max(1, parseInt(limit.toString())))
      : 20;

    try {
      return await this.recordService.findAll(
        q,
        artist,
        album,
        format,
        category,
        pageNum,
        limitNum,
        fields,
      );
    } catch (error) {
      console.error('Error in findAll:', error);
      throw new InternalServerErrorException('Failed to retrieve records');
    }
  }

  @Get('mb/fetch/:mbid')
  @ApiOperation({
    summary: 'Fetch and display data from MusicBrainz API for a given MBID',
  })
  @ApiResponse({
    status: 200,
    description: 'MusicBrainz data fetched successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'MusicBrainz ID not found or invalid',
  })
  @ApiParam({ name: 'mbid', description: 'MusicBrainz ID' })
  async fetchMusicBrainzData(@Param('mbid') mbid: string): Promise<any> {
    const data = await this.recordService.fetchMusicBrainzDataPublic(mbid);
    if (!data) {
      throw new NotFoundException(
        'Failed to fetch data from MusicBrainz or invalid MBID',
      );
    }
    return data;
  }

  @Get('mb/:mbid')
  @ApiOperation({ summary: 'Get a record by MusicBrainz ID' })
  @ApiResponse({ status: 200, description: 'Record found' })
  @ApiResponse({ status: 404, description: 'Record not found' })
  @ApiParam({ name: 'mbid', description: 'MusicBrainz ID' })
  async findByMBID(@Param('mbid') mbid: string): Promise<Record> {
    const record = await this.recordService.findByMBID(mbid);
    if (!record) {
      throw new NotFoundException('Record not found');
    }
    return record;
  }
}

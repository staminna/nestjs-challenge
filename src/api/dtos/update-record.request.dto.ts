import {
  IsString,
  IsNumber,
  Min,
  Max,
  IsInt,
  IsEnum,
  IsOptional,
  ValidateNested,
  IsArray,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { RecordFormat, RecordCategory } from '../schemas/record.enum';
import { TrackDTO } from './create-record.request.dto';
import { Type } from 'class-transformer';

export class UpdateRecordRequestDTO {
  @ApiProperty({
    description: 'Artist of the record',
    type: String,
    example: 'The Beatles',
    required: false,
  })
  @IsString()
  @IsOptional()
  artist?: string;

  @ApiProperty({
    description: 'Album name',
    type: String,
    example: 'Abbey Road',
    required: false,
  })
  @IsString()
  @IsOptional()
  album?: string;

  @ApiProperty({
    description: 'Price of the record',
    type: Number,
    example: 30,
    required: false,
  })
  @IsNumber()
  @Min(0)
  @Max(10000)
  @IsOptional()
  price?: number;

  @ApiProperty({
    description: 'Quantity of the record in stock',
    type: Number,
    example: 1000,
    required: false,
  })
  @IsInt()
  @Min(0)
  @Max(100)
  @IsOptional()
  qty?: number;

  @ApiProperty({
    description: 'Format of the record (Vinyl, CD, etc.)',
    enum: RecordFormat,
    example: RecordFormat.VINYL,
    required: false,
  })
  @IsEnum(RecordFormat)
  @IsOptional()
  format?: RecordFormat;

  @ApiProperty({
    description: 'Category or genre of the record (e.g., Rock, Jazz)',
    enum: RecordCategory,
    example: RecordCategory.ROCK,
    required: false,
  })
  @IsEnum(RecordCategory)
  @IsOptional()
  category?: RecordCategory;

  @ApiProperty({
    description: 'Musicbrainz identifier',
    type: String,
    example: 'b10bbbfc-cf9e-42e0-be17-e2c3e1d2600d',
    required: false,
  })
  @IsOptional()
  mbid?: string;

  @ApiProperty({
    description: 'List of tracks in the album',
    type: [TrackDTO],
    example: [
      { title: 'Come Together', position: 'A1', duration: 259733 },
      { title: 'Something', position: 'A2', duration: 181880 },
    ],
    required: false,
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TrackDTO)
  @IsOptional()
  trackList?: TrackDTO[];
}

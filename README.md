# Record Store API

## Improvements

### Performance Optimization
- **MongoDB Indexing**: Added text indexes and field-specific indexes for faster searches
- **Optimized Queries**: Replaced in-memory filtering with MongoDB query operators
- **Pagination**: Added pagination support to limit result size and improve response times
- **Connection Pooling**: Configured optimal connection pool settings for MongoDB
- **Text Search**: Implemented MongoDB text search for fast full-text searching

### MusicBrainz Integration
- Auto-fetches detailed record information when a MusicBrainz ID (MBID) is provided
- Automatically populates track lists from MusicBrainz data during record creation and updates
- Each track includes title, position, and duration information
- Implements proper rate limiting and error handling for MusicBrainz API calls
- Caches MusicBrainz data to reduce API calls and improve performance
- Supports XML response format as required
- Gracefully handles API failures and continues with record creation/update
- Provides endpoints to directly fetch MusicBrainz data for a given MBID

### API Enhancements
- Added proper RESTful endpoints for CRUD operations
- Improved validation and error handling
- Enhanced Swagger documentation
- Added CORS support
- Added global routing prefix

## Installation

### Install dependencies:

```bash
$ npm install
````

### Docker for MongoDB Emulator
To use the MongoDB Emulator, you can start it using Docker:
```
npm run mongo:start
```
This will start a MongoDB instance running on your local machine. You can customize the settings in the Docker setup by modifying the docker-compose-mongo.yml if necessary. In the current configuration, you will have a MongoDB container running, which is accessible at localhost:27017.
This mongo url will be necessary on the .env file, with example as follows:

```
MONGO_URL=mongodb://localhost:27017/records
```
This will point your application to a local MongoDB instance.

### MongoDB Data Setup
The data.json file contains example records to seed your database. The setup script will import the records from this file into MongoDB.

To set up the database with the example records:

```
npm run setup:db
```
This will prompt the user to cleanup (Y/N) existing collection before importing data.json


#### data.json Example
Here's an example of the data.json file that contains records:
```
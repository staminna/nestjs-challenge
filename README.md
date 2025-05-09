# Record Store API

## Improvements

### Performance Optimization
- **MongoDB Indexing**: Added text indexes and field-specific indexes for faster searches
- **Optimized Queries**: Replaced in-memory filtering with MongoDB query operators
- **Pagination**: Added pagination support to limit result size and improve response times
- **Connection Pooling**: Configured optimal connection pool settings for MongoDB
- **Text Search**: Implemented MongoDB text search for fast full-text searching

### MusicBrainz Integration
- Auto-fetches detailed record information when a MusicBrainz ID is provided
- Populates track lists automatically from MusicBrainz data
- Track information including title, position, and duration is stored with each record
- Implemented proper rate limiting and error handling for MusicBrainz API calls

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
Here’s an example of the data.json file that contains records:
```
[
    {
        "artist": "Foo Fighters",
        "album": "Foo Fighers",
        "price": 8,
        "qty": 10,
        "format": "CD",
        "category": "Rock",
        "mbid": "d6591261-daaa-4bb2-81b6-544e499da727"
  },
  {
        "artist": "The Cure",
        "album": "Disintegration",
        "price": 23,
        "qty": 1,
        "format": "Vinyl",
        "category": "Alternative",
        "mbid": "11af85e2-c272-4c59-a902-47f75141dc97"
  },
]
```

### Running the App
#### Development Mode
To run the application in development mode (with hot reloading):

```
npm run start:dev
```
#### Production Mode
To build and run the app in production mode:

```
npm run start:prod
```

### Tests
#### Run Unit Tests
To run unit tests:

```
npm run test
```
To run unit tests with code coverage:

```
npm run test:cov
```
This will show you how much of your code is covered by the unit tests.
#### Run End-to-End Tests
To run end-to-end tests:
```
npm run test:e2e
```
Run Tests with Coverage


Run Linting
To check if your code passes ESLint checks:

```
npm run lint
```
This command will show you any linting issues with your code.


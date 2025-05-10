const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

async function seedDatabase() {
  const uri = 'mongodb://localhost:27017/records';
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const database = client.db('records');
    const records = database.collection('records');

    // Load data from data.json
    const dataPath = path.join(__dirname, 'data.json');
    console.log(`Loading data from ${dataPath}`);
    
    if (!fs.existsSync(dataPath)) {
      console.error(`File not found: ${dataPath}`);
      return;
    }

    const rawData = fs.readFileSync(dataPath, 'utf-8');
    const recordsData = JSON.parse(rawData);

    // Add isUserCreated flag to all records
    const recordsWithFlag = recordsData.map(record => ({
      ...record,
      isUserCreated: false,
      created: new Date(),
      lastModified: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    }));

    console.log(`Prepared ${recordsWithFlag.length} records for insertion`);

    // Insert records
    const result = await records.insertMany(recordsWithFlag, { ordered: false })
      .catch(err => {
        if (err.code === 11000) {
          console.warn('Some records already exist in the database');
          return { insertedCount: err.result?.nInserted || 0 };
        }
        throw err;
      });

    console.log(`Successfully inserted ${result.insertedCount} records!`);
  } catch (err) {
    console.error('Error seeding database:', err);
  } finally {
    await client.close();
    console.log('Database connection closed');
  }
}

seedDatabase().catch(console.error); 
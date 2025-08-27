const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');
const cron = require('node-cron');

const backupData = async () => {
    // Configuration
    const databaseName = 'iiqup';
    const backupPath = 'C:\\mongoData';
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017';
        
    // Generate timestamp for backup folder
    const timestamp = new Date().toISOString()
        .replace(/[:.]/g, '-')
        .replace('T', '_')
        .split('.')[0];
    
    const backupName = `backup_${databaseName}_${timestamp}`;
    const backupFullPath = path.join(backupPath, backupName);

    try {
        // Create backup directory if it doesn't exist
        console.log('🔍 Checking backup directory...');
        if (!fs.existsSync(backupPath)) {
            console.log('📂 Creating backup directory...');
            fs.mkdirSync(backupPath, { recursive: true });
            console.log('✅ Backup directory created successfully');
        } else {
            console.log('✅ Backup directory exists');
        }

        if (!fs.existsSync(backupFullPath)) {
            fs.mkdirSync(backupFullPath, { recursive: true });
        }

        console.log(`🔄 Starting backup: ${backupName}`);
        console.log(`⏳ Please wait... This may take a while for large databases`);
        
        console.log('🔗 Connecting to MongoDB...');
        
        // Connect to MongoDB using Node.js driver
        const client = new MongoClient(mongoUri);
        await client.connect();
        console.log('✅ Connected to MongoDB successfully');

        const db = client.db(databaseName);
        
        // Get all collections
        console.log('📦 Getting list of collections...');
        const collections = await db.listCollections().toArray();
        console.log(`📋 Found ${collections.length} collections to backup`);

        const startTime = Date.now();
        let totalDocuments = 0;
        
        // Backup each collection
        for (let i = 0; i < collections.length; i++) {
            const collectionInfo = collections[i];
            const collectionName = collectionInfo.name;
            
            console.log(`📋 [${i + 1}/${collections.length}] Backing up collection: ${collectionName}`);
            
            try {
                const collection = db.collection(collectionName);
                const documents = await collection.find({}).toArray();
                
                const filePath = path.join(backupFullPath, `${collectionName}.json`);
                fs.writeFileSync(filePath, JSON.stringify(documents, null, 2));
                
                totalDocuments += documents.length;
                console.log(`✅ ${collectionName}: ${documents.length} documents backed up`);
                
            } catch (collectionError) {
                console.error(`❌ Failed to backup collection ${collectionName}:`, collectionError.message);
            }
        }

        await client.close();
        console.log('🔌 MongoDB connection closed');

        const endTime = Date.now();
        const duration = ((endTime - startTime) / 1000).toFixed(2);

        // Verify backup was created
        console.log('🔍 Verifying backup...');
        if (fs.existsSync(backupFullPath)) {
            const files = fs.readdirSync(backupFullPath);
            console.log(`📦 Backup contains ${files.length} collection files`);
            console.log(`📋 Files: ${files.join(', ')}`);
        }

    } catch (error) {
        console.error('❌ Backup failed:', error.message);
        console.error('🔧 Troubleshooting:');
        console.error('   - Check if MongoDB is running');
        console.error('   - Verify database name is correct');
        console.error('   - Check MongoDB connection URI');
        console.error('   - Ensure sufficient disk space');
    }
};

// Auto backup middleware
const autoBackup = () => {
    console.log('🚀 Starting auto-backup system...');
    console.log('📅 Current time:', new Date().toLocaleString());
    console.log('⏰ Scheduled for: Every hour');
    
    // Schedule hourly backup
    cron.schedule('0 * * * *', () => {
        console.log('\n=================================');
        console.log('⏰ HOURLY BACKUP TRIGGERED');
        console.log('📅 Time:', new Date().toLocaleString());
        console.log('=================================');
        backupData();
    });

    console.log('✅ Auto-backup system initialized successfully');
    console.log('📊 System status: ACTIVE - Running every hour');

    // Return middleware function
    return (req, res, next) => {
        next();
    };
};

module.exports = { autoBackup };
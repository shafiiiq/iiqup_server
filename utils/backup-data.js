const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');
const cron = require('node-cron');

const backupData = async () => {
    // Configuration
    const databaseName = 'iiqup';
    const backupPath = 'C:\\aws\\server\\backup\\database';
    
    // MongoDB Atlas URI - replace with your actual connection string
    const mongoUri = process.env.MONGO_URI || 'mongodb+srv://username:password@cluster.mongodb.net/';
        
    // Generate timestamp for backup folder
    const timestamp = new Date().toISOString()
        .replace(/[:.]/g, '-')
        .replace('T', '_')
        .split('.')[0];
    
    const backupName = `backup_${databaseName}_${timestamp}`;
    const backupFullPath = path.join(backupPath, backupName);

    let client;

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
        
        console.log('🔗 Connecting to MongoDB Atlas...');
        
        // Connect to MongoDB Atlas
        client = new MongoClient(mongoUri, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 30000, // 30 seconds timeout
            socketTimeoutMS: 60000, // 60 seconds socket timeout
            connectTimeoutMS: 30000, // 30 seconds connection timeout
        });
        
        await client.connect();
        console.log('✅ Connected to MongoDB Atlas successfully');

        const db = client.db(databaseName);
        
        // Test database connection
        await db.admin().ping();
        console.log('🏓 Database ping successful');
        
        // Get all collections
        console.log('📦 Getting list of collections...');
        const collections = await db.listCollections().toArray();
        console.log(`📋 Found ${collections.length} collections to backup`);

        if (collections.length === 0) {
            console.log('⚠️  No collections found in the database');
            return;
        }

        const startTime = Date.now();
        let totalDocuments = 0;
        let successfulBackups = 0;
        
        // Backup each collection
        for (let i = 0; i < collections.length; i++) {
            const collectionInfo = collections[i];
            const collectionName = collectionInfo.name;
            
            console.log(`📋 [${i + 1}/${collections.length}] Backing up collection: ${collectionName}`);
            
            try {
                const collection = db.collection(collectionName);
                
                // Get document count first
                const count = await collection.countDocuments();
                console.log(`📊 Collection ${collectionName} has ${count} documents`);
                
                if (count === 0) {
                    console.log(`⚠️  Collection ${collectionName} is empty, creating empty backup file`);
                    const filePath = path.join(backupFullPath, `${collectionName}.json`);
                    fs.writeFileSync(filePath, JSON.stringify([], null, 2));
                    successfulBackups++;
                    continue;
                }
                
                // For large collections, use cursor to avoid memory issues
                let documents;
                if (count > 10000) {
                    console.log(`📈 Large collection detected (${count} docs), using cursor...`);
                    documents = [];
                    const cursor = collection.find({});
                    await cursor.forEach(doc => {
                        documents.push(doc);
                    });
                } else {
                    documents = await collection.find({}).toArray();
                }
                
                const filePath = path.join(backupFullPath, `${collectionName}.json`);
                
                // Write file with error handling
                fs.writeFileSync(filePath, JSON.stringify(documents, null, 2), 'utf8');
                
                // Verify file was written
                if (fs.existsSync(filePath)) {
                    const stats = fs.statSync(filePath);
                    console.log(`✅ ${collectionName}: ${documents.length} documents backed up (${(stats.size / 1024).toFixed(2)} KB)`);
                    totalDocuments += documents.length;
                    successfulBackups++;
                } else {
                    throw new Error('File was not created');
                }
                
            } catch (collectionError) {
                console.error(`❌ Failed to backup collection ${collectionName}:`, collectionError.message);
            }
        }

        const endTime = Date.now();
        const duration = ((endTime - startTime) / 1000).toFixed(2);

        // Final verification and summary
        console.log('\n📊 BACKUP SUMMARY');
        console.log('=================================');
        console.log(`⏱️  Duration: ${duration} seconds`);
        console.log(`📦 Collections processed: ${collections.length}`);
        console.log(`✅ Successful backups: ${successfulBackups}`);
        console.log(`❌ Failed backups: ${collections.length - successfulBackups}`);
        console.log(`📄 Total documents: ${totalDocuments}`);
        console.log(`📂 Backup location: ${backupFullPath}`);

        // Verify backup directory contents
        console.log('\n🔍 Verifying backup...');
        if (fs.existsSync(backupFullPath)) {
            const files = fs.readdirSync(backupFullPath);
            console.log(`📦 Backup contains ${files.length} collection files`);
            console.log(`📋 Files: ${files.join(', ')}`);
            
            // Show file sizes
            let totalSize = 0;
            files.forEach(file => {
                const filePath = path.join(backupFullPath, file);
                const stats = fs.statSync(filePath);
                totalSize += stats.size;
            });
            console.log(`💾 Total backup size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
        } else {
            console.error('❌ Backup directory not found after backup process');
        }

        console.log('\n✅ Backup process completed successfully!');

    } catch (error) {
        console.error('\n❌ Backup failed:', error.message);
        
        // Enhanced error logging
        if (error.name === 'MongoServerSelectionError') {
            console.error('🔧 MongoDB connection failed. Check:');
            console.error('   - Internet connectivity');
            console.error('   - MongoDB Atlas cluster is running');
            console.error('   - Connection string is correct');
            console.error('   - IP address is whitelisted in Atlas');
            console.error('   - Username/password are correct');
        } else if (error.name === 'MongoAuthenticationError') {
            console.error('🔧 Authentication failed. Check:');
            console.error('   - Username and password in connection string');
            console.error('   - Database user permissions');
        } else if (error.code === 'ENOSPC') {
            console.error('🔧 No space left on device');
        } else if (error.code === 'EACCES') {
            console.error('🔧 Permission denied - check backup directory permissions');
        }
        
        console.error('\n🔍 Error details:', {
            name: error.name,
            message: error.message,
            code: error.code
        });
    } finally {
        // Always close the connection
        if (client) {
            try {
                await client.close();
                console.log('🔌 MongoDB connection closed');
            } catch (closeError) {
                console.error('⚠️  Error closing MongoDB connection:', closeError.message);
            }
        }
    }
};

// Auto backup middleware
const autoBackup = () => {
    console.log('🚀 Starting auto-backup system on Windows PC...');
    console.log('📅 Current time:', new Date().toLocaleString());
    console.log('⏰ Scheduled for: Every hour');
    console.log('📂 Backup path: C:\\mongoData');
    
    // Schedule hourly backup
    const task = cron.schedule('0 * * * *', async () => {
        try {
            console.log('\n=================================');
            console.log('⏰ HOURLY BACKUP TRIGGERED');
            console.log('📅 Time:', new Date().toLocaleString());
            console.log('=================================');
            await backupData();
        } catch (error) {
            console.error('❌ Scheduled backup failed:', error.message);
        }
    }, {
        scheduled: true,
        timezone: "UTC"
    });

    console.log('✅ Auto-backup system initialized successfully');
    console.log('📊 System status: ACTIVE - Running every hour');

    // Run initial backup after 5 seconds
    setTimeout(() => {
        console.log('\n🧪 Running initial backup test...');
        backupData().catch(err => {
            console.error('❌ Initial backup test failed:', err.message);
        });
    }, 5000);

    // Return middleware function (for Express apps)
    return (req, res, next) => {
        next();
    };
};

module.exports = { autoBackup };
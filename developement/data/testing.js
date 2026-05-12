require('dotenv').config({ path: '../../.env' });
const mongoose = require('mongoose');
const User = require('../../models/user.model.js');
const bcrypt = require('bcrypt');

async function addActivationKey() {
    await mongoose.connect(process.env.MONGO_URI);

    const userId = "682340924f7cbbb08067f24e"
    const activationKey = "64023780361485037615"
    const hashedKey = await bcrypt.hash(activationKey, 10);

    const result = await User.updateOne(
        { _id: userId },
        {
            $set: {
                signatureActivation: ['pm', 'wm', 'accounts', 'manager', 'authorized', 'seal'].map(signType => ({
                    signType,
                    activationKey: hashedKey,
                    trustedDevices: [],
                    isActivated: false
                })),
                updatedAt: new Date()
            }
        }
    );

    return result;
}

addActivationKey().then(result => {
    console.log('Activation key added successfully:', result);
}).catch(error => {
    console.error('Error adding activation key:', error);
}).finally(() => {
    mongoose.disconnect();
    process.exit();
});
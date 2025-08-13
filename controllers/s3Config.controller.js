const s3Services = require('../services/s3Config-services')

const getS3Config = async (req, res) => {
    s3Services.fetchPresignedURL(req.body.key, req.body.isLong)
        .then((s3Data) => {
            if (s3Data) {
                res.status(s3Data.status).json(s3Data)
            }
        })
        .catch((err) => {
            res.status(err.status || 500).json({ message: 'Cannot get all users', error: err.message })
        })
}

module.exports = {
    getS3Config
};

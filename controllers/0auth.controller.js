const _0authServices = require('../services/0auth-services')

const verifyRefresh = async (req, res) => {
    const { refreshToken } = req.body;
    _0authServices.authRefresh(refreshToken)
        .then((refresh) => {
            if (refresh) {
                res.status(refresh.status).json(refresh)
            }
        })
        .catch((err) => {
            res.status(err.status || 500).json({ error: err.message })
        })
}

module.exports = {
    verifyRefresh,
};

const networkServices = require('../services/network-services');

class NetworkController {
  async speedtest(req, res) {
    try {
      return res.status(200).json({ ok: true });
    } catch (error) {
      return res.status(500).json({ ok: false });
    }
  }
}

module.exports = new NetworkController();
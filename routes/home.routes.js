const express = require('express');
const router = express.Router();

// Landing page
router.get('/', (req, res) => {
  res.send(`
        hewwo
        <br>
        go to /healthcheck to see if things r working
        <br>
        you can find the repo <a href="https://github.com/TDI-BI/emailListMiddleware">here</a>

        <div style="position: fixed; bottom: 8px; right: 8px; z-index: 9999;">
            <img
                src="https://image-cdn-ak.spotifycdn.com/image/ab67706c0000da8478a40cf60fa6da97a2726821"
                alt="mio chibina"
                style="width: 80px; border-radius: 6px;"
            >
        </div>
    `);
});

// Healthcheck
router.get('/healthcheck', (req, res) => {
  res.send('online');
  /*
  res.json({
    status: 'ok',
    env: process.env.PROD === 'true' ? 'production' : 'development',
    time: new Date().toISOString(),
  });
   */
});

module.exports = router;

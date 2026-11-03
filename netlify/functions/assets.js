const fs = require('fs');
const path = require('path');

exports.handler = async function(event, context) {
  try {
    const manifestPath = path.resolve(__dirname, '../../assets/histologia/manifest.json');
    if (fs.existsSync(manifestPath)) {
      const data = fs.readFileSync(manifestPath, 'utf8');
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=60, stale-while-revalidate=300'
        },
        body: data
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ total: 0, assets: [] })
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};

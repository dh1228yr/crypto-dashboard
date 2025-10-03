const express = require('express');
const cors = require('cors');
const axios = require('axios');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 3000;

// 업비트 API
app.post('/api/upbit/balance', async (req, res) => {
    try {
        const { accessKey, secretKey } = req.body;
        
        const payload = {
            access_key: accessKey,
            nonce: Date.now().toString()
        };
        
        const jwtToken = jwt.sign(payload, secretKey);
        
        const response = await axios.get('https://api.upbit.com/v1/accounts', {
            headers: {
                'Authorization': 'Bearer ' + jwtToken
            }
        });
        
        let totalKRW = 0;
        response.data.forEach(account => {
            if (account.currency === 'KRW') {
                totalKRW = totalKRW + parseFloat(account.balance);
            }
        });
        
        res.json({ 
            success: true, 
            balance: totalKRW
        });
        
    } catch (error) {
        console.error('Upbit Error:', error.response ? error.response.data : error.message);
        res.json({ 
            success: false, 
            error: error.message,
            balance: 0
        });
    }
});

// 빗썸 API
app.post('/api/bithumb/balance', async (req, res) => {
    try {
        const { connectKey, secretKey } = req.body;
        
        const endpoint = '/info/balance';
        const nonce = Date.now().toString();
        const currency = 'BTC';
        
        const data = endpoint + String.fromCharCode(0) + 'currency=' + currency + String.fromCharCode(0) + nonce;
        const signature = crypto.createHmac('sha512', secretKey).update(data).digest('hex');
        
        const response = await axios.post('https://api.bithumb.com/info/balance', 
            'currency=' + currency,
            {
                headers: {
                    'Api-Key': connectKey,
                    'Api-Sign': signature,
                    'Api-Nonce': nonce,
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        );
        
        const balance = parseFloat(response.data.data.total_krw || 0);
        
        res.json({ 
            success: true, 
            balance: balance
        });
        
    } catch (error) {
        console.error('Bithumb Error:', error.response ? error.response.data : error.message);
        res.json({ 
            success: false, 
            error: error.message,
            balance: 0
        });
    }
});

// 바이낸스 API
app.post('/api/binance/balance', async (req, res) => {
    try {
        const { apiKey, secretKey } = req.body;
        
        const timestamp = Date.now();
        const queryString = 'timestamp=' + timestamp;
        
        const signature = crypto.createHmac('sha256', secretKey).update(queryString).digest('hex');
        
        const response = await axios.get(
            'https://api.binance.com/api/v3/account?' + queryString + '&signature=' + signature,
            {
                headers: {
                    'X-MBX-APIKEY': apiKey
                }
            }
        );
        
        let totalUSDT = 0;
        response.data.balances.forEach(balance => {
            if (balance.asset === 'USDT') {
                totalUSDT = totalUSDT + parseFloat(balance.free) + parseFloat(balance.locked);
            }
        });
        
        res.json({ 
            success: true, 
            balance: totalUSDT
        });
        
    } catch (error) {
        console.error('Binance Error:', error.response ? error.response.data : error.message);
        res.json({ 
            success: false, 
            error: error.message,
            balance: 0
        });
    }
});

// 바이빗 API
app.post('/api/bybit/balance', async (req, res) => {
    try {
        const { apiKey, secretKey } = req.body;
        
        const timestamp = Date.now();
        const recvWindow = 5000;
        
        const queryString = 'api_key=' + apiKey + '&recv_window=' + recvWindow + '&timestamp=' + timestamp;
        const signature = crypto.createHmac('sha256', secretKey).update(queryString).digest('hex');
        
        console.log('Bybit Request URL:', 'https://api.bybit.com/v5/account/wallet-balance?accountType=UNIFIED&' + queryString + '&sign=' + signature);
        
        const response = await axios.get(
            'https://api.bybit.com/v5/account/wallet-balance?accountType=UNIFIED&' + queryString + '&sign=' + signature,
            {
                headers: {
                    'X-BAPI-API-KEY': apiKey,
                    'X-BAPI-TIMESTAMP': timestamp.toString(),
                    'X-BAPI-SIGN': signature,
                    'X-BAPI-RECV-WINDOW': recvWindow.toString()
                }
            }
        );
        
        console.log('Bybit Raw Response:', JSON.stringify(response.data, null, 2));
        
        let balance = 0;
        console.log('Bybit API Response:', JSON.stringify(response.data, null, 2));
        
        if (response.data.result && response.data.result.list && response.data.result.list.length > 0) {
            const account = response.data.result.list[0];
            balance = parseFloat(account.totalEquity || account.totalWalletBalance || account.totalAvailableBalance || 0);
            
            // 모든 코인 잔고 합산 (대안)
            if (balance === 0 && account.coin) {
                account.coin.forEach(function(c) {
                    balance = balance + parseFloat(c.walletBalance || 0);
                });
            }
        }
        
        res.json({ 
            success: true, 
            balance: balance
        });
        
    } catch (error) {
        console.error('Bybit Error:', error.response ? error.response.data : error.message);
        console.error('Bybit Full Error:', JSON.stringify(error.response?.data || error, null, 2));
        res.json({ 
            success: false, 
            error: error.message,
            balance: 0
        });
    }
});

// OKX API
app.post('/api/okx/balance', async (req, res) => {
    try {
        const { apiKey, secretKey, passphrase } = req.body;
        
        const timestamp = new Date().toISOString();
        const method = 'GET';
        const requestPath = '/api/v5/account/balance';
        
        const prehash = timestamp + method + requestPath;
        const signature = crypto.createHmac('sha256', secretKey).update(prehash).digest('base64');
        
        const response = await axios.get(
            'https://www.okx.com' + requestPath,
            {
                headers: {
                    'OK-ACCESS-KEY': apiKey,
                    'OK-ACCESS-SIGN': signature,
                    'OK-ACCESS-TIMESTAMP': timestamp,
                    'OK-ACCESS-PASSPHRASE': passphrase
                }
            }
        );
        
        let balance = 0;
        if (response.data.data && response.data.data[0]) {
            balance = parseFloat(response.data.data[0].totalEq || 0);
        }
        
        res.json({ 
            success: true, 
            balance: balance
        });
        
    } catch (error) {
        console.error('OKX Error:', error.response ? error.response.data : error.message);
        res.json({ 
            success: false, 
            error: error.message,
            balance: 0
        });
    }
});

const HOST = process.env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost';

app.listen(PORT, HOST, () => {
    console.log('===========================================');
    console.log('✅ 프록시 서버 실행 중!');
    console.log('🌐 주소: http://' + HOST + ':' + PORT);
    console.log('📊 대시보드를 열고 API 키를 입력하세요!');
    console.log('===========================================');

});





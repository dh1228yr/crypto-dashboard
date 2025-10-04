const express = require('express');
const cors = require('cors');
const axios = require('axios');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 3000;
const HOST = process.env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost';

// 헬스체크 엔드포인트
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/', (req, res) => {
    res.json({ message: 'Crypto Dashboard API Server Running' });
});

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
        
        // 파라미터 없이 시도
        const params = '';
        
        // Signature: endpoint + \0 + params + \0 + nonce
        const signData = endpoint + String.fromCharCode(0) + params + String.fromCharCode(0) + nonce;
        const signature = crypto.createHmac('sha512', secretKey).update(signData).digest('hex');
        
        console.log('=== Bithumb Request Debug (No Params) ===');
        console.log('Endpoint:', endpoint);
        console.log('Params:', params || '(empty)');
        console.log('Nonce:', nonce);
        console.log('Sign Data Length:', signData.length);
        console.log('Signature:', signature.substring(0, 30) + '...');
        
        // GET 방식으로 시도
        const response = await axios.get(
            'https://api.bithumb.com' + endpoint,
            {
                headers: {
                    'Api-Key': connectKey,
                    'Api-Sign': signature,
                    'Api-Nonce': nonce
                }
            }
        );
        
        console.log('Bithumb Response:', JSON.stringify(response.data, null, 2));
        
        let balance = 0;
        if (response.data.status === '0000' && response.data.data) {
            balance = parseFloat(response.data.data.total_krw || 0);
        }
        
        res.json({ 
            success: true, 
            balance: balance
        });
        
    } catch (error) {
        console.error('=== Bithumb Error ===');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', JSON.stringify(error.response.data, null, 2));
        } else {
            console.error('Message:', error.message);
        }
        
        res.json({ 
            success: false, 
            error: error.response?.data || error.message,
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
        
        const timestamp = Date.now().toString();
        const recvWindow = '5000';
        
        const queryString = 'accountType=UNIFIED';
        const signStr = timestamp + apiKey + recvWindow + queryString;
        const signature = crypto.createHmac('sha256', secretKey).update(signStr).digest('hex');
        
        console.log('=== Bybit Request Debug ===');
        console.log('Timestamp:', timestamp);
        console.log('API Key:', apiKey.substring(0, 8) + '...');
        console.log('Sign String:', signStr);
        console.log('Signature:', signature);
        
        const response = await axios.get(
            'https://api.bybit.com/v5/account/wallet-balance?accountType=UNIFIED',
            {
                headers: {
                    'X-BAPI-API-KEY': apiKey,
                    'X-BAPI-TIMESTAMP': timestamp,
                    'X-BAPI-SIGN': signature,
                    'X-BAPI-RECV-WINDOW': recvWindow
                }
            }
        );
        
        console.log('Bybit API Response:', JSON.stringify(response.data, null, 2));
        
        let balance = 0;
        if (response.data.result && response.data.result.list && response.data.result.list.length > 0) {
            const account = response.data.result.list[0];
            balance = parseFloat(account.totalEquity || 0);
        }
        
        res.json({ 
            success: true, 
            balance: balance
        });
        
    } catch (error) {
        console.error('=== Bybit Error Details ===');
        console.error('Message:', error.message);
        
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Headers:', error.response.headers);
            console.error('Data:', JSON.stringify(error.response.data, null, 2));
        } else {
            console.error('No Response:', error);
        }
        
        res.json({ 
            success: false, 
            error: error.response?.data || error.message,
            balance: 0
        });
    }
});

app.listen(PORT, HOST, () => {
    console.log('===========================================');
    console.log('✅ 프록시 서버 실행 중!');
    console.log('🌐 주소: http://' + HOST + ':' + PORT);
    console.log('📊 대시보드를 열고 API 키를 입력하세요!');
    console.log('===========================================');
});








const bodyParser = require('body-parser');
const express = require('express');
const session = require('express-session'); 
const port = 3000;
require('dotenv').config();
const request = require('request');
const passport = require('passport');
require('./passportConfig.js'); 
const AWS = require('aws-sdk');
const dotenv = require('dotenv');
const bcrypt = require('bcrypt');
const axios = require('axios'); // Install axios with npm install axios

dotenv.config();
const saltRounds = 10;

AWS.config.update({
  region: 'us-east-1',
  accessKeyId: process.env.ACCESS_KEY,
  secretAccessKey: process.env.SECRET_ACCESS_KEY
});

const docClient = new AWS.DynamoDB.DocumentClient();

const app = express();

// Middleware configuration
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } 
}));
app.use(express.static('public'));
app.use(passport.initialize());
app.use(passport.session());

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.set('view engine', 'ejs');



// Routes
app.post('/login', (req, res, next) => {
    passport.authenticate('local', (err, user) => {
        if (err) {
            console.error('Login error:', err);
            return next(err);
        }
        if (!user) {
            console.warn('Failed login for user');
           return res.redirect('/login?error=found');
        }
        req.logIn(user, (err) => {
            if (err) {
                console.error('Error logging in user');
                return next(err);
            }
            console.log('User logged in successfully');
            return res.redirect('/');
        });
    })(req, res, next);
});

app.post('/deleteTransaction', async (req, res) => {
    if (req.isAuthenticated()) {
        const params = {
            TableName: 'crypto-transactions',
            Key: {
                id: Number(req.body.id) // Ensure id is a number
            }};
        try {
            await docClient.delete(params).promise();
            console.log('Transaction deleted.');
            res.redirect('/portfolio');
        }
        catch (error) {
            console.error('Error deleting transaction:', error);
            res.status(500).send('Error deleting transaction');
        };
    }
    else {
    res.redirect('/login');
    }
});
app.post('/createSellTransaction', async (req, res) => {
    const assetName = (req.body.asset).trim().toLowerCase();
    const result = await docClient.scan({ TableName: 'crypto-transactions' }).promise();
    const count = result.Count;
    if (req.isAuthenticated()) {
        const params = {
            TableName: 'crypto-transactions',
            Item: {
                id: count + 1,
                user: req.user.id,
                asset: assetName,
                quantity: req.body.quantity,
                price: req.body.price,
                date: req.body.date,
                type: 'Sell'
            }};
        try {
            await docClient.put(params).promise();
            console.log('Transaction created.');
            res.redirect('/portfolio');
        }
        catch (error) {
            console.error('Error creating transaction:', error);
            res.status(500).send('Error creating transaction');
        }
    } else {
    res.redirect('/login');
    }
})
app.post('/createBuy', async (req, res) => {
    const assetName = (req.body.asset || '').trim().toLowerCase();
    const result = await docClient.scan({ TableName: 'crypto-transactions' }).promise();
    const count = result.Count;
    if (req.isAuthenticated()) {
        const params = {
            TableName: 'crypto-transactions',
            Item: {
                id: count + 1,
                user: req.user.id,
                asset: assetName,
                quantity: req.body.quantity,
                price: req.body.price,
                date: req.body.date,
                type: 'Buy'
            }
        };
        try {
            await docClient.put(params).promise();
            console.log('Transaction created.');
            res.redirect('/portfolio');
        } catch (error) {
            console.error('Error creating transaction:', error);
            res.status(500).send('Error creating transaction');
        }
    } else {
        res.redirect('/login');
    }
});

app.post('/register', async (req, res) => {

    if (req.body.password !== req.body.confirmPassword) {
        console.error('Passwords do not match');
        return res.status(400).send('Passwords do not match');
    }
    const hashedPassword = await bcrypt.hash(req.body.password, saltRounds);
    try {
        // Get count of items in crypto-users
        const userExists = await docClient.scan({ TableName: 'crypto-users', 
        FilterExpression: 'email = :email',
        ExpressionAttributeValues: {
            ':email': req.body.email.toLowerCase()
         }}).promise();
        if (userExists.Count > 0) {
            console.error('User already exists');
            return res.redirect('/register?error=exists');
        };
        const result = await docClient.scan({ TableName: 'crypto-users' }).promise();
        const count = result.Count;
        const params = {
            TableName: 'crypto-users',
            Item: {
                id: count + 1, // Ensure id is a number
                email: req.body.email.toLowerCase(),
                password: hashedPassword,
                username: req.body.email,
                picture: 'https://static.vecteezy.com/system/resources/previews/021/548/095/original/default-profile-picture-avatar-user-avatar-icon-person-icon-head-icon-profile-picture-icons-default-anonymous-user-male-and-female-businessman-photo-placeholder-social-network-avatar-portrait-free-vector.jpg'
            }
        };
        await docClient.put(params).promise();
        console.log('User registered.');
        res.redirect('/login?registered=true');
    } catch (error) {
        console.error('Error registering user:', error);
        res.status(500).send('Error registering user');
    }
});

app.post('/submitProfileChanges', async (req) => {
    const image = req.body.picture;
    const base64Image = Buffer.from(image).toString('base64');

    const params = {
        TableName: 'crypto-users',
        Key: {
            id: Number(req.user.id) // Ensure id is a number
        },
        UpdateExpression: 'set picture = :picture, username = :username',
        ExpressionAttributeValues: {
            ':picture': base64Image,
            ':username': req.body.username
        },
        ReturnValues: 'UPDATED_NEW'  // Return updated attributes
    };

    try {
        const data = await docClient.update(params).promise();
        console.log('User profile updated:', data);
    } catch (err) {
        console.error('Unable to update item. Error JSON:', JSON.stringify(err, null, 2));

    }
});
app.get('/userTransactions', async (req, res) => {
    if (req.isAuthenticated()) {
        const params = {
            TableName: 'crypto-transactions',
            FilterExpression: '#user = :user',
            ExpressionAttributeNames: {
              '#user': 'user'  // Use #user to refer to the 'user' attribute
            },
            ExpressionAttributeValues: { 
              ':user': req.user.id,
            }};
        try {
            const data = await docClient.scan(params).promise();
            res.status(200).json(data);
        }
        catch (err)
        {
            console.error('Unable to read item. Error JSON:', JSON.stringify(err, null, 2));
            res.status(500).json({ error: 'Unable to read item' });
        }
        };
        })

        app.get('/userAssets', async (req, res) => {
            if (req.isAuthenticated()) {
                const params = {
                    TableName: 'crypto-transactions',
                    FilterExpression: '#user = :user',
                    ExpressionAttributeNames: {
                        '#user': 'user'
                    },
                    ExpressionAttributeValues: {
                        ':user': req.user.id,
                    }
                };
        
                try {
                    // Fetch data from DynamoDB
                    const data = await docClient.scan(params).promise();
                    
                    // Initialize a Set to store unique user coins
                    const userCoins = new Set();
        
                    // Iterate over the items and add assets to the Set
                    for (const item of data.Items) {
                        userCoins.add(item.asset); // Use add to ensure uniqueness
                    }
        
                    // Convert the Set to an Array to handle async operations
                    const coinPromises = Array.from(userCoins).map(async (coin) => {
                        let amount = 0;
        
                        for (const transaction of data.Items) {
                            if (transaction.asset === coin) {
                                if (transaction.type === 'Buy') {
                                    amount += Number(transaction.quantity);
                                } else if (transaction.type === 'Sell') {
                                    amount -= Number(transaction.quantity);
                                }
                            }
                        }
        
                        try {
                            const response = await axios.get(`http://api.coincap.io/v2/assets/${coin.toLowerCase()}`);
                            const assetData = response.data.data;
                            return {
                                asset: coin,
                                quantity: amount,
                                price: assetData.priceUsd,
                                dailyChange: assetData.changePercent24Hr,
                                value: amount * assetData.priceUsd
                            };
                        } catch (error) {
                            console.error(`Error fetching data for ${coin}:`, error);
                            return null;
                        }
                    });
        
                    // Wait for all promises to resolve
                    const resolvedAssets = await Promise.all(coinPromises);
                    // Filter out any null values that may have resulted from API errors
                    const filteredAssets = resolvedAssets.filter(asset => asset !== null);
        
                    res.status(200).json({
                        userAssets: filteredAssets
                    });
        
                } catch (error) {
                    console.error('Error scanning DynamoDB:', error);
                    if (!res.headersSent) {
                        res.status(500).json({ error: 'An error occurred while fetching data.' });
                    }
                }
            } else {
                res.status(401).json({ error: 'Unauthorized' });
            }
        });

app.get('/login', (req, res) => {
    res.render('login');
});

app.get('/register', (req, res) => {
    res.render('register');
});
app.get('/portfolio', (req, res) => {
    // get current date
    if (req.isUnauthenticated()) {
        return res.redirect('/login');
    }
    const today = new Date();
    res.render('portfolio', { user: req.user, nowDate: today });
});

app.get('/', (req, res) => {
    if (req.isUnauthenticated()) {
        return res.redirect('/login');
    }

    const options = {
        method: 'GET',
        url: 'http://api.coincap.io/v2/assets?limit=2000',
        headers: {}
    };

    request(options, function (error, response) {
        if (error) {
            console.error('API request error:', error);
            return res.status(500).send('Internal Server Error');
        }

        let data = response.body;

        try {
            data = JSON.parse(data);  // Parse the API response body
            const assets = data.data; // Access the 'data' property in the response

            // Render the page with assets and user picture
            res.render('index', { data: assets, user: req.user });
        } catch (parseError) {
            console.error('Error parsing API response:', parseError);
            res.status(500).send('Error processing API data');
        }
    });
});

app.get('/profile', (req, res) => {
    if (req.isUnauthenticated()) {
        return res.redirect('/login');
    }
    res.render('profile', { user: req.user });
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
})
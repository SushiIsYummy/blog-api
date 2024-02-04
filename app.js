require('dotenv').config();
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const mongoose = require('mongoose');
const cors = require('cors');
const indexRouter = require('./routes/index');
const usersRouter = require('./routes/users');
const blogsRouter = require('./routes/blogs');
const postsRouter = require('./routes/posts');
const authRouter = require('./routes/auth');
const authenticateUser = require('./middleware/authenticateUserMiddleware');

// Connect to MongoDB using Mongoose
mongoose.connect(process.env.MONGODB_URI);

// Mongoose connection event handlers
const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', () => {
  console.log('Connected to MongoDB');
});

const app = express();

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(cors());
app.use(authenticateUser);

app.use('/', indexRouter);
app.use('/api/users', usersRouter);
app.use('/api/blogs', blogsRouter);
app.use('/api/posts', postsRouter);
app.use('/api/auth', authRouter);

app.use((req, res, next) => {
  return res.status(404).send({
    status: 'fail',
    message: 'Resource not found',
  });
});

module.exports = app;

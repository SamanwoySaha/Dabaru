import express from 'express';
import dotenv from 'dotenv';
import cors from "cors";
import v1Router from './router/v1';

const app = express();
dotenv.config();

app.use(express.json());

const allowedHosts = process.env.ALLOWED_HOSTS
  ? process.env.ALLOWED_HOSTS.split(',') 
  : [];

app.use(
  cors({
    origin: allowedHosts,
    methods: 'GET,POST,PUT,DELETE',
    credentials: true
  })
);

app.use('/v1', v1Router);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
import * as dotenv from 'dotenv';

dotenv.config();

export const AppConfig = {
  mongoUrl: process.env.MONGODB_URI || 'mongodb://localhost:27017/records',
  port: process.env.PORT || 3000,
};

export const appConfig = () => ({
  mongoUrl: process.env.MONGODB_URI || 'mongodb://localhost:27017/records',
  port: parseInt(process.env.PORT) || 3000,
});

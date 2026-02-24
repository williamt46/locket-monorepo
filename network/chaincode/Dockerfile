FROM node:18-alpine

WORKDIR /chaincode

COPY package*.json ./

RUN npm install --production

COPY . .

EXPOSE 9999

CMD ["npm", "start"]

FROM node:16

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install
RUN curl -s -O https://www8.cao.go.jp/chosei/shukujitsu/syukujitsu.csv
COPY . .

CMD [ "npx", "ts-node", "src/index.ts" ]
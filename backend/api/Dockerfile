# prereq: first do `yarn build` to compile typescript & etc.

FROM node:20-alpine
WORKDIR /usr/src/app

# Install PM2 globally
RUN yarn global add pm2

# first get dependencies in for efficient docker layering
COPY dist/package.json dist/yarn.lock ./
RUN yarn install --frozen-lockfile --production

# then copy over typescript payload
COPY dist ./

# Copy the PM2 ecosystem configuration
COPY ecosystem.config.js ./

# ENV PORT=80
EXPOSE 80/tcp
EXPOSE 8090/tcp
EXPOSE 8091/tcp
EXPOSE 8092/tcp

# # Use PM2 to run the application with the ecosystem config
CMD ["pm2-runtime", "ecosystem.config.js"]

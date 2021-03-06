'use strict';

const test = require('ava');
const sinon = require('sinon');
const request = require('supertest');
const moment = require('moment');

const awsServices = require('@cumulus/aws-client/services');
const {
  randomId
} = require('@cumulus/common/test-utils');

const EarthdataLoginClient = require('@cumulus/api/lib/EarthdataLogin');

const models = require('@cumulus/api/models');
const { fakeAccessTokenFactory } = require('@cumulus/api/lib/testUtils');

process.env.EARTHDATA_CLIENT_ID = randomId('edlID');
process.env.EARTHDATA_CLIENT_PASSWORD = randomId('edlPW');
process.env.DISTRIBUTION_REDIRECT_ENDPOINT = 'http://example.com';
process.env.DISTRIBUTION_ENDPOINT = `https://${randomId('host')}/${randomId('path')}`;
process.env.AccessTokensTable = randomId('tokenTable');
process.env.TOKEN_SECRET = randomId('tokenSecret');

let accessTokenModel;
let authorizationUrl;

// import the express app after setting the env variables
// const { distributionApp } = require('../distribution');
const { distributionApp } = require('..');


test.before(async () => {
  accessTokenModel = new models.AccessToken('token');
  await accessTokenModel.createTable();

  authorizationUrl = randomId('authURL');
  const stubbedAccessToken = fakeAccessTokenFactory();

  sinon.stub(
    EarthdataLoginClient.prototype,
    'getAccessToken'
  ).callsFake(() => stubbedAccessToken);

  sinon.stub(
    EarthdataLoginClient.prototype,
    'getAuthorizationUrl'
  ).callsFake(() => authorizationUrl);
});

test.after.always(async () => {
  await accessTokenModel.deleteTable();
  sinon.reset();
});

test('An authorized s3credential requeste invokes NGAPs request for credentials with username from accessToken cookie', async (t) => {
  const username = randomId('username');
  const fakeCredential = { Payload: JSON.stringify({ fake: 'credential' }) };

  const spy = sinon.spy(() => Promise.resolve(fakeCredential));
  sinon.stub(awsServices, 'lambda').callsFake(() => ({
    invoke: (params) => ({
      promise: () => spy(params)
    })
  }));

  const accessTokenRecord = fakeAccessTokenFactory({ username });
  await accessTokenModel.create(accessTokenRecord);

  process.env.STSCredentialsLambda = 'Fake-NGAP-Credential-Dispensing-Lambda';
  const FunctionName = process.env.STSCredentialsLambda;
  const Payload = JSON.stringify({
    accesstype: 'sameregion',
    returntype: 'lowerCamel',
    duration: '3600',
    rolesession: username,
    userid: username
  });

  await request(distributionApp)
    .get('/s3credentials')
    .set('Accept', 'application/json')
    .set('Cookie', [`accessToken=${accessTokenRecord.accessToken}`])
    .expect(200);

  console.log(spy.args);
  t.true(spy.called);
  t.deepEqual(spy.args[0][0], {
    FunctionName,
    Payload
  });
});

test('An s3credential request without access Token redirects to Oauth2 provider.', async (t) => {
  const response = await request(distributionApp)
    .get('/s3credentials')
    .set('Accept', 'application/json')
    .expect(307);

  t.is(response.status, 307);
  t.is(response.headers.location, authorizationUrl);
});

test('An s3credential request with expired accessToken redirects to Oauth2 provider', async (t) => {
  const accessTokenRecord = fakeAccessTokenFactory({
    expirationTime: moment().unix()
  });
  await accessTokenModel.create(accessTokenRecord);

  const response = await request(distributionApp)
    .get('/s3credentials')
    .set('Accept', 'application/json')
    .set('Cookie', [`accessToken=${accessTokenRecord.accessToken}`])
    .expect(307);

  t.is(response.status, 307);
  t.is(response.headers.location, authorizationUrl);
});

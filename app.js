const createError = require('http-errors');
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const cors = require('cors');
const crypto = require('crypto');


const app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(cors())
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

/*BigQuery*/

const {BigQuery} = require('@google-cloud/bigquery');
const options = {
  keyFilename: path.join(__dirname, 'coral-circlet-403815-1d277f08cf3f.json'),
  projectId: 'coral-circlet-403815',
};
const bigquery = new BigQuery(options);
const datasetId = 'help_desk'
const tableId = 'tickets'

app.post("/add_ticket", (req, res) => {
  let newTicket = {
    uuid: crypto.randomUUID(),
    name: req.body.name,
    email: req.body.email,
    description: req.body.description,
    status: req.body.status
  };
  async function insertRowsAsStream() {
    await bigquery.dataset(datasetId).table(tableId).insert(newTicket);
    console.log(`Inserted row`);
  }
  insertRowsAsStream().then(r => res.end());

});

app.post("/update_ticket", (req, res) => {

  console.log(req.body)
  const uuid = req.body.uuid;
  const status = req.body.status;
  const writeResponse = req.body.response;

  async function updateRow() {

    const options = {
      location: 'US',
    };

    let query;

    if (!req.body.isUpdateResponse) {
      query = `UPDATE coral-circlet-403815.help_desk.tickets SET status = @status WHERE uuid = @uuid`;
      options.params = {status: status, uuid: uuid}
    }

    else {
      query = `UPDATE coral-circlet-403815.help_desk.tickets SET response = @response WHERE uuid = @uuid`;
      options.params = {response: writeResponse, uuid: uuid}
    }

    options.query = query;

    const [job] = await bigquery.createQueryJob(options);
    console.log(`Job ${job.id} started.`);

    const [rows] = await job.getQueryResults();

    console.log('Rows:');
    rows.forEach(row => console.log(row));
  }
  updateRow().then(r => res.end());

});

app.get('/tickets', async (req, res) => {

  async function getAll() {

    const query = `SELECT * FROM ${datasetId}.${tableId} ORDER BY name ASC`;

    const options = {
      query,
      location: 'US',
    };

    try {
      const [rows] = await bigquery.query(options);
      res.json(rows)
    } catch (error) {
      console.error('Error in getting list:', error);
    }

  }
  getAll().then(r => {
    res.end();
  });
})

// app.use(express.static('routes'));

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;

var nodemailer = require('nodemailer');

var handlebars = require('handlebars');

var fs = require('fs');

var path = require('path');

import { emailConfig } from '../config';

var readHTMLFile = function (path, callback) {
  fs.readFile(path, { encoding: 'utf-8' }, function (err, html) {
    if (err) {
      throw err;
      callback(err);
    }
    else {
      callback(null, html);
    }
  });
};

const transport = nodemailer.createTransport(emailConfig);

const send = (to: string, subject: string, body: {}, template: string) => {
  readHTMLFile(path.join(__dirname, '..', 'emailTemplates', template, 'template.html'), function (err, html) {
    var template = handlebars.compile(html);
    var htmlToSend = template(body);
    var mailOptions = {
      from: 'comision.electoral@ucv.com',
      to: to,
      subject: subject,
      html: htmlToSend
    };
    transport.sendMail(mailOptions, function (error, response) { });
  });
}

export const emailService = {
  send
}
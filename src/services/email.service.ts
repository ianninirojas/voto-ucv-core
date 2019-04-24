var sender = 'smtps://voto.ucv%40gmail.com'   // The emailto use in sending the email(Change the @ symbol to %40 or do a url encoding )
var password = 'koko151215'  // password of the email to use

var nodemailer = require('nodemailer');
var handlebars = require('handlebars');
var fs = require('fs');
var path = require('path');

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

// const transport = nodemailer.createTransport({
//   host: mailConfig.host,
//   secure: mailConfig.secure,
//   port: mailConfig.port,
//   auth: {
//     user: mailConfig.auth.user,
//     pass: mailConfig.auth.pass
//   }
// });

const transport = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  secure: true,
  port: 465,
  auth: {
    user: 'voto.ucv@gmail.com',
    pass: 'koko151215'
  }
});

export const emailService = {
  send(to: string, subject: string, body: {}, template: string) {
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
}
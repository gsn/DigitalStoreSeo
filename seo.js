var fs = require("fs"),
	 casper = require('casper');

var XML_CHAR_MAP = {
  '<': '&lt;',
  '>': '&gt;',
  '&': '&amp;',
  '"': '&quot;',
  "'": '&apos;'
};
 
function escapeXml (s) {
  return s.replace(/[<>&"']/g, function (ch) {
    return XML_CHAR_MAP[ch];
  });
}

var runner = casper.create({
        pageSettings: {
            loadImages: false,         // The WebPage instance used by Casper will
            loadPlugins: true,         // use these settings
            localToRemoteUrlAccessEnabled: true
        },
        verbose: false                 // log messages will be printed out to the console
    });
var sitePath = 'http://' + runner.cli.get(0).replace(/(\/)+$/gi, '').replace('http://', '');
var siteId = runner.cli.get(1);

var options = {
    runner: runner,
    // this is the query that set on the firstUrl of the website
    initialQuery: '/?sfs=true',
    // that's the path where the snapshots should be placed
    // it's empty by default which means they will go into the directory
    // where your capserjs javascript file is placed
    snapshotPath: 'snapshots/' + (siteId ? siteId + '/' : ''),
    // you can choose a prefix for your snapshots
    // by default it's ''
    fileNamePrefix: '',
    // by default the task waits 1s before fetching the html.
    // this is to give the page enough time to to assemble itself.
    // if your page needs more time, tweak here.
    msWaitForPages: 1000,
    // sanitize function to be used for filenames. Converts invalid character or number to '_' as default
    // has a filename argument, must have a return that is a sanitized string
    sanitize: function (requestUri) {
        // remove any initialQuery and normalize
        return requestUri.replace(options.initialQuery, '').replace(/[^a-zA-Z0-9]/gi, '_');
    },
    // if you would rather not keep the script tags in the html snapshots
    // set `removeScripts` to true. It's false by default
    removeScripts: true,
    // remove inline style tags
    removeStyles: false,
    // set `removeLinkTags` to true. It's false by default
    removeLinkTags: false,
    // set `removeMetaTags` to true. It's false by default
    removeMetaTags: false,
    // set `removeIframes` to true. It's false by default
    removeIframes: true,
    // here goes the list of all urls that should be fetched
    replaceStrings: [
	],
    // first level urls, replace this with your own array
    urls: [
	  '/storelocator',
	  '/changepassword',
	  '/circular',
	  '/circular/textview',
	  '/circular/listview',
	  '/contactus',
	  '/coupons',
	  '/mealplannerfull',
	  '/savedlists',
	  '/mylist',
	  '/mypantry',
	  '/myrecipes',
	  '/myspecials',
	  '/product',
	  '/profile',
	  '/recipecenter',
	  '/recoverpassword',
	  '/recoverusername',
	  '/registration',
	  '/registration/facebook',
	  '/specials',
	  '/unsubscribe'
    ],
    // urls discovered or scraped from run
    foundUrls: [],
    // url proccessed counter
    proccessedCounter: 0,
    // script that execute on phantonjs page to get links
    getLinks: function () {
        var links = document.querySelectorAll('a');
        return Array.prototype.map.call(links, function (e) {
            return e.getAttribute('href');
        });
    },
    // script that scrape links and push into queue
    scrapeLinks: function (self, nextLevel) {
        var newLinks = self.evaluate(options.getLinks);
        for (var i = 0; i < newLinks.length; i++) {
            var url = newLinks[i].replace(/\s+/gi, '').toLowerCase();
            options.pushNextUrl(url, nextLevel);
        }
    },
    // push a url into the queue to be proccess
    pushNextUrl: function (url, nextLevel) {
        if (!(/^(?:[a-z]+:)?\/\//i.test(url)) && url.indexOf('?show=event&') < 0 
          && url.indexOf('javascript') < 0 && url != '' && url.indexOf(':') < 0 
          && url.indexOf('#') < 0 && url.indexOf('.php') < 0 && url.indexOf('.aspx') < 0) {
            if (url.indexOf('/') < 0) url = '/' + url;
            if (options.urls.indexOf(url) < 0 && options.foundUrls.indexOf(url) < 0 && nextLevel.indexOf(url) < 0) {
                // console.log('Found url: ' + url);
                options.foundUrls.push(url);
                nextLevel.push(url);
            }
        }
    },
    // write the sitemap url to file
    writeSiteMapUrl: function (url) {
        url = escapeXml(url);

        var xmlStr = '\r\n  <url>';
        xmlStr += "\r\n    <loc>" + url + "</loc>";
        xmlStr += "\r\n    <changefreq>daily</changefreq>";
        xmlStr += "\r\n    <priority>1.0</priority>";
        xmlStr += "\r\n  </url>";

        fs.write(options.siteMapFile + '.xml', xmlStr, 'a');
        fs.write(options.siteMapFile + '.txt', url + '\r\n', 'a');
    },
    // prcoess the html content and write to file
    processUrl: function (msg, url, isIndex) {
        options.writeSiteMapUrl(options.sitePath + url);

        var plainUrl = url.replace(options.sitePath, '');

        var fileName = options.snapshotPath +
						options.fileNamePrefix +
						options.sanitize(plainUrl) +
						'.html';

        // remove weird or invalid new lines        
        msg = msg.replace(/\\n|\\t|\\r|\\f/g, '');
        msg = msg.replace(/\=\"\/\//gi, '="http://');
        msg = msg.replace(/<head>[+\s\S]+<meta charset=\"utf-8\"/gi, '<head><meta charset="utf-8"');
        msg = msg.replace(/<!--begin:analytics[+\s\S]+<!--end:analytics-->/gi, '');
        msg = msg.replace('{"ContentBaseUrl":', '{"dontUseProxy": true,"ContentBaseUrl":');

        if (isIndex) {
          fs.write(options.snapshotPath + 'index.html', msg, 'w');
        }
        
        if (options.removeScripts) {
            msg = msg.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
        }

       
        if (options.removeIframes) {
            msg = msg.replace(/<iframe.+?<\/iframe>/gi, '');
        }

        options.replaceStrings.forEach(function (obj) {
            var key = Object.keys(obj);
            var value = obj[key];
            var regex = new RegExp(key, 'g');
            msg = msg.replace(regex, value);
        });

        // shrinking the file
        msg = msg.replace(/\n|\t|\f|\r/g, '');
        msg = msg.replace(/<!--.*?-->/g, '');
        msg = msg.replace(/( data-[^=]*=")([^"])*(")/gi, '');
        msg = msg.replace(/(\>\s+\<)+/g, '\>\n\<');
        msg = msg.replace(/\s+/g, ' ');
        msg = msg.replace(/></g, '>\r\n<');

        fs.write(fileName, msg, 'w');
        options.proccessedCounter++;
        console.log(("000" + options.proccessedCounter).slice(-3) + ': ' + url);
    },
    processLinks: function (links) {
        options.runner.each(links, function (self, link) {
            var fullUrl = options.sitePath + link;
            this.then(function() {
              var realUrl = self.evaluate(function(link) {
                window.gsn.goUrl(link);
                return window.location.href;
              }, link);
              
              // console.log(realUrl);
              this.wait(options.msWaitForPages, function () {
                options.processUrl(this.getHTML(), link);
                /*var nextLinks = [];
                options.scrapeLinks(this, nextLinks);
                if (nextLinks.length > 0) {
                    options.processLinks(nextLinks);
                }*/
              });
            });
           
        })
    }
};

options.sitePath = sitePath;

fs.removeTree(options.snapshotPath);
options.siteMapFile = options.snapshotPath + 'sitemap';
options.firstUrl = options.sitePath + options.initialQuery;
options.runner.echo('\ncontacting: ' + options.firstUrl);

// writing the first sitemap
fs.write(options.siteMapFile + '.xml', '<?xml version="1.0" encoding="UTF-8"?>\r\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">', 'w');

options.runner.start(options.firstUrl, function () {
    this.echo('first contact made: live long and prosper\n');
    console.log(options.firstUrl);
    
    this.wait(5000, function () {
        options.processUrl(this.getHTML(), '/', true);
        options.processLinks(options.urls);
    });
});

// finally, write the end of sitemap
options.runner.on('run.complete', function () {
    fs.write(options.siteMapFile + '.xml', '</urlset>', 'a');
    this.echo('\nDone!\n').exit();
});

options.runner.run();

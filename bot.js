/* 
	TODO
	# Implementeren van logging naar file via winston https://stackoverflow.com/questions/12016474/node-js-logging
    # charcount voor mooiere uitlijning?
    # insta delete na zoveel sec. 
    # pm's?
    
    DONE
	# Vergroten van tijdsnotatie in getCurrTime -> getCurrentTime
*/

var Discord = require('discord.io');
var logger = require('winston');
var auth = require('./auth.json');

// Configure logger settings
logger.remove(logger.transports.Console);
logger.add(logger.transports.Console, {
    colorize: true
});
logger.level = 'debug';

// SQLite connection
var sqlite3 = require('sqlite3').verbose();

let db = new sqlite3.Database('/home/pogo/TRTDD-Rankings/db/pogo.db', sqlite3.OPEN_READWRITE, (err) => {
    if (err) {
        logger.error(err.message);
    } else {
        logger.info(getCurrentTime()+': Connected to the PoGo database.');
    }
});


//db.close((err) => {
//  if (err) {
//    console.error(err.message);
//  }
//  logger.info('Close the database connection.');
//});

// Initialize Discord Bot

var bot = new Discord.Client({
   token: auth.token,
   autorun: true
});

bot.on('ready', function (evt) {
    logger.info(getCurrentTime()+': Connected to Discord');
    bot.setPresence({ game: { name: '!rankings' } });
});

bot.on('disconnect', function() {
    logger.info(getCurrentTime()+': Bot disconnected');
    bot.connect() //Auto reconnect
});

bot.on('message', function (user, userID, channelID, message, evt) {
    // Our bot needs to know if it will execute a command
    
    /*var serverID    = bot.channels[channelID].guild_id;
    var server      = bot.servers[serverID];
    var roles       = server.roles;
    var member      = server.members[userID];
    
    if (member) { // or else it will break when webhooks are caled (no member role)
        var hasAdmin    = member.roles.some(roleID => roles[roleID].GENERAL_ADMINISTRATOR);
    }*/
    
    if (message.substring(0, 1) == '!') {
        //remove space between ! and cmd
        if (message.substring(1, 2) == ' ') {
            var args = message.substring(2).split(' ');
        } else {
            var args = message.substring(1).split(' ');
        }
        var difftypes   = ['xp','battles','berries','stops','defended','catches','raids','legendary','gyms','evolves','research'];
        var scoretype   = 'xp';
        var querylimit  = '10';
        
        var cmd         = args[0].toLowerCase();        
        var firstval    = args[1];        
        var secondval   = args[2];
		
        /*//////////////////////////////////////////////// CASE RANKINGS //////////////////////////////////////////////*/
        
        switch(cmd) {
            // !ping
            case 'rankings':
                // SQL Query
                        
                if (!isEmpty(firstval) && contains.call(difftypes, firstval)) scoretype = firstval;
                if (!isEmpty(secondval) && isNumeric(secondval)) querylimit = secondval;
                
                db.serialize(() => {
                    
                    getRankings(scoretype,querylimit,channelID,userID);
                    
                    setTimeout(function() {
                        bot.deleteMessage({                                    
                            channelID: channelID,
                            messageID: evt.d.id,
                        });
                        logger.info(getCurrentTime()+': Ranking opvraagbericht verwijderd.');
                    }, 5000); // delete after 5 sec
                    
                });
                
            break;
				
        /*////////////////////////////////////////////// CASE  STATS ///////////////////////////////////////////////*/

            // !ping
            case 'stats':
                // SQL Query
                
                db.serialize(() => {
                    
                    getUserRankings(channelID,userID);
                    
                    setTimeout(function() {
                        bot.deleteMessage({
                            channelID: channelID,
                            messageID: evt.d.id,
                        });
                        logger.info(getCurrentTime()+': Ranking user opvraagbericht verwijderd.');
                    }, 5000); // delete after 5 sec
                    
                });
                
            break;
                
            /*//////////////////////////////////////////////// CASE TRAINER NAME //////////////////////////////////////////////*/
            
            case 'username':
            case 'trainername':
            case 'trainer':
                
                db.serialize(() => {
					
                    db.get("SELECT username FROM users WHERE discord_id='"+userID+"'", function(err, row) {
                        if (row !== undefined) {
                            
                            db.run("UPDATE users SET username = '"+firstval+"' WHERE discord_id = '"+userID+"'", (err, row) => {
                                if (err){
                                    throw err;
                                } else {
                                    logger.info(getCurrentTime()+': '+firstval+ ' met Discord ID '+userID+' heeft username aangepast.');
                                    bot.sendMessage({
                                        to: channelID,
                                        message: 'Bedankt <@'+userID+'>, je trainernaam is gewijzigd.'
                                    }, function(err, res) {
                                        if (!err) {
                                            setTimeout(function() {
                                                bot.deleteMessage({                                    
                                                    channelID: channelID,
                                                    messageID: res.id,
                                                });
                                                logger.info(getCurrentTime()+': Rankings bot trainer name change verwijderd.');
                                            }, 20000); // delete after 20 sec

                                        } else {
                                            logger.info(err);
                                        }
                                    });                                    
                                }
                            });                          
                            
                        } else {
                            
                            db.run("INSERT INTO users(username,discord_id) VALUES('"+firstval+"','"+userID+"')", (err, row) => {
                                if (err){
                                    throw err;
                                } else {
                                    logger.info(getCurrentTime()+': '+firstval+ ' met Discord ID '+userID+' toegevoegd aan database.');   
                                    bot.sendMessage({
                                        to: channelID,
                                        message: 'Bedankt <@'+userID+'>, je kunt nu je scores invoeren. Zie pinned message voor meer details.'
                                    }, function(err, res) {
                                        if (!err) {
                                            setTimeout(function() {
                                                bot.deleteMessage({                                    
                                                    channelID: channelID,
                                                    messageID: res.id,
                                                });
                                                logger.info(getCurrentTime()+': Rankings bot startbericht verwijderd.');
                                            }, 20000); // delete after 20 sec

                                        } else {
                                            logger.info(err);
                                        }
                                    });                                    
                                }
                            });
                            
                        }
                    });
					
					setTimeout(function() {
                        bot.deleteMessage({
                            channelID: channelID,
                            messageID: evt.d.id,
                        });
                        logger.info(getCurrentTime()+': Trainer added bericht verwijderd.');
                    }, 5000); // delete after 5 sec					
					
                });
                
            break;


            /*//////////////////////////////////////////////// CASE CITY/REGION //////////////////////////////////////////////*/
            
            case 'city':
			case 'steden':
            case 'region':
			case 'regio':
            case 'regions': 
				
				var validinput = false;	
				firstval = message.split(' ').slice(1).join(' ');
				firstval = firstval.replace(/\s/g,'');
				if (!firstval.match(/[a-zA-Z]/i)) validinput = true;
               
                db.serialize(() => {
     
                    db.get("SELECT username FROM users WHERE discord_id='"+userID+"'", function(err, row) {
                        
                        if (row !== undefined && validinput) {

							if (cmd == 'city') {                    			
								var value = firstval.split(',',1).join(',').replace(/(.+$)/i,'$1').trim();
								var typename = 'stad';
							} else {
								var value = firstval.split(',',3).join(',');
								var value = value.replace(/(^,)|(,$)/g, '');
								var typename = 'speelregio';
								cmd = 'region';
							}

							db.run("UPDATE users SET "+cmd+" = '"+value+"' WHERE discord_id = '"+userID+"'", (err, row) => {
								if (err){
									throw err;
								} else  {
									logger.info(getCurrentTime()+': '+userID+' heeft '+typename+' bijgewerkt.');
									bot.sendMessage({
										to: channelID,
										message: 'Bedankt <@'+userID+'>, je '+typename+' is bijgewerkt.'
									}, function(err, res) {
										if (!err) {
											setTimeout(function() {
												bot.deleteMessage({                                    
													channelID: channelID,
													messageID: res.id,
												});
												logger.info(getCurrentTime()+': Rankings bot trainer '+typename+' bijgewerkt met val '+value+' '+firstval+'.');
											}, 20000); // delete after 20 sec

										} else {
											logger.info(err);
										}
									});                                    
								}
							});                          

						} else {

							bot.sendMessage({
								to: channelID,
								message: 'Helaas <@'+userID+'>, er ging iets mis, ben je al wel aangemeld met !trainer?. Misschien een spatie teveel?'
							}, function(err, res) {
								if (!err) {
									setTimeout(function() {
										bot.deleteMessage({                                    
											channelID: channelID,
											messageID: res.id,
										});
										logger.info(getCurrentTime()+': Rankings bot trainer cities/regions error bericht verwijderd.');
									}, 20000); // delete after 20 sec

								} else {
									logger.info(err);
								}
							});

						}

						setTimeout(function() {
							bot.deleteMessage({
								channelID: channelID,
								messageID: evt.d.id,
							});
							logger.info(getCurrentTime()+': Trainer '+typename+' bijgewerkt verwijderd.');
						}, 5000); // delete after 5 sec					

					});
				});
                
            break;
                
            /*//////////////////////////////////////////////// CASE TYPES //////////////////////////////////////////////*/
                
            case 'xp':
            case 'battles':
            case 'berries':
            case 'stops':
            case 'catches':
            case 'defended':
            case 'raids':
            case 'legendary':        
            case 'gyms':
            case 'evolves':
            case 'research':
                                    
                var validnumber = false;
                if (isNumeric(firstval) && firstval!='') {
                    validnumber = true;                
                    var badgetype = getBadgeName(cmd);
                }
                
                db.serialize(() => {
     
                    db.get("SELECT username FROM users WHERE discord_id='"+userID+"'", function(err, row) {
                        
                        if (row !== undefined && validnumber) {
                            
                            db.run("INSERT INTO progress(type,value,date,discord_id) VALUES('"+cmd+"','"+firstval+"','"+getCurrentTime()+"','"+userID+"')", (err, row) => {
                                if (err){
                                    throw err;
                                } else {
                                    logger.info(getCurrentTime()+': '+badgetype+' is bijgewerkt door trainer met Discord ID '+userID+'.');      
                                    
                                    bot.sendMessage({
                                        to: channelID,
                                        message: 'Je '+badgetype+' score is bijgewerkt <@'+userID+'>!'
                                    }, function(err, res) {
                                        if (!err) {
                                            setTimeout(function() {
                                                bot.deleteMessage({                                    
                                                    channelID: channelID,
                                                    messageID: res.id,
                                                });
                                                logger.info(getCurrentTime()+': Rankings bot meldingsbericht verwijderd.');
                                            }, 20000); // delete after 20 sec

                                        } else {
                                            logger.info(err);
                                        }
                                    }); 
                                    
                                    getRankings(cmd,'10',channelID,userID);
                                }
                            });

                        } else {
                            
                            var errormsg = '';                            
                            if (!validnumber) {
                                errormsg = 'Er ging iets mis, probeer het opnieuw, <@'+userID+'>.';
                            } else {
                                errormsg = 'Je moet eerst je trainer name instellen, bv: `!trainer <@'+userID+'>`.';
                            }
							
							bot.sendMessage({
								to: channelID,
								message: errormsg
							}, function(err, res) {
								if (!err) {
									setTimeout(function() {
										bot.deleteMessage({                                    
											channelID: channelID,
											messageID: res.id,
										});
										logger.info(getCurrentTime()+': Error progress input meldingsbericht verwijderd.');
									}, 20000); // delete after 20 sec

								} else {
									logger.info(err);
								}
							});
                            
                        }
                    });
                    
                   	setTimeout(function() {
                        bot.deleteMessage({                                    
                            channelID: channelID,
                            messageID: evt.d.id,
                        });
                        logger.info(getCurrentTime()+': Ranking invoerbericht verwijderd.');
                    }, 5000); // delete after 5 sec
                    
                });
                
            break;
                
            /*//////////////////////////////////////////////// CASE HELP //////////////////////////////////////////////*/
                
            case 'help':                    
                    
                logger.info(getCurrentTime()+': Help opgevraagd door user met Discord ID '+userID+'.');                
                bot.sendMessage({
                    to: channelID,
                    message: 'Scroll helemaal naar boven of bekijk de Pinned Message voor uitleg van deze bot, <@'+userID+'>.'
                }, function(err, res) {
                    if (!err) {
                        setTimeout(function() {
                            bot.deleteMessage({                                    
                                channelID: channelID,
                                messageID: res.id,
                            });
                            logger.info(getCurrentTime()+': Rankings bot helpbericht verwijderd.');
                        }, 20000); // delete after 20 sec

                    } else {
                        logger.info(err);
                    }
                });
                
                setTimeout(function() {
                    bot.deleteMessage({                                    
                        channelID: channelID,
                        messageID: evt.d.id,
                    });
                    logger.info(getCurrentTime()+': Ranking hulpbericht verwijderd.');
                }, 5000); // delete after 5 sec
                
            break;    
                
         }
     }
});


/*//////////////////////////////////////////////// FUNCTIONS //////////////////////////////////////////////*/

function getRankings(scoretype,querylimit,channelID,userID) {
    var scorelist = '';
    var i = 1;
    var badgetype = getBadgeName(scoretype);

    var selectquery = "SELECT * FROM progress INNER JOIN users ON progress.discord_id = users.discord_id WHERE type = '"+scoretype+"' GROUP BY progress.discord_id ORDER BY value DESC LIMIT "+querylimit+"";

    db.each(selectquery, function(err, row) {

        if (err){
            logger.info(err);
        } else {
            var editdate = row.date;
            var daydif = getDayDifference(getCurrentTime(), editdate);
            var daysago = '';
            if (daydif>0) daysago = ' ('+daydif+' dgn)';
            var displaylevel = '';
            if (scoretype=='xp') displaylevel = ' ('+calcLevel(row.value)+')';
            var trainername = row.username;
			var ilength = i+'. ';
            var spaces = Array(24-(ilength.length+trainername.length)).join(' ');

            scorelist += ilength+trainername+displaylevel+spaces+makeMillions(row.value)+daysago+'\n';
            i++;
        }

    }, function(){

        //logger.info('HOI: '+scorelist);
        logger.info(getCurrentTime()+': Rankings requested: '+selectquery);
		
		
		if (scorelist.length > 1024) { // discord embed limit of 1024 char
			
			bot.sendMessage({
				to: channelID,
				message: 'Helaas, dit bericht is te lang. Probeer het met een lager getal <@'+userID+'>.'
			}, function(err, res) {
				if (!err) {
					setTimeout(function() {
						bot.deleteMessage({
							channelID: channelID,
							messageID: res.id,
						});
						logger.info(getCurrentTime()+': Rankings bot post too long verwijderd.');
					}, 20000); // delete after 20 sec

				} else {
					logger.info(err);
				}
			});
						
		} else {

			bot.sendMessage({
				to: channelID,
				embed: {
						color: 14417972,
						description: 'De huidige tussenstand is als volgt:\n\n',
						title: 'TRTDD Trainer Top '+querylimit+': '+badgetype,
						thumbnail: {
						  url: 'https://www.ubierfestival.nl/pokemailer/images/'+scoretype+'.png'
						},
						fields: [
							{
								name: 'Trainers ('+(i-1)+'):',
								value: '`'+scorelist+'`'
							}
						]
					}
			}, function(err, res) {
				if (!err) {
					setTimeout(function() {
						bot.deleteMessage({
							channelID: channelID,
							messageID: res.id,
						});
						logger.info(getCurrentTime()+': getRankings post verwijderd.');
					}, 20000); // delete after 20 sec

				} else {
					logger.info(err);
				}
			});
		}
    });
}
	
	
function getUserRankings(channelID,userID) {
    var scorelist = '';
	var badgetype = '';
	var rowcount_user = '';
	var rowcount_total = '';
	var trainername = '';
	
    var selectquery = "SELECT * FROM progress INNER JOIN users ON progress.discord_id = users.discord_id WHERE progress.discord_id = '"+userID+"' GROUP BY type ORDER BY type DESC";

    db.each(selectquery, function(err, row) {

        if (err){
            logger.info(err);
        } else {
			
            trainername = row.username;
            var scorevalue 	= row.value;
            var scoretype = row.type;
            badgetype = getBadgeName(scoretype);

            var spaces = Array(18-badgetype.length).join(' ');
            scorelist += badgetype+spaces+makeMillions(row.value)+'\n';
        }

    }, function(){

        //logger.info('HOI: '+scorelist);
        logger.info(getCurrentTime()+': User rankings requested: '+selectquery);		
		bot.sendMessage({
			to: channelID,
			embed: {
				color: 14417972,
				description: 'Jouw scores zijn als volgt:\n\n',
				title: 'Persoonlijke scores',
				thumbnail: {
				  url: 'https://www.ubierfestival.nl/pokemailer/images/xp.png'
				},
				fields: [
					{
						name: trainername+':',
						value: '`'+scorelist+'`'
					}
				]
			}
		}, function(err, res) {
			if (!err) {
				setTimeout(function() {
					bot.deleteMessage({
						channelID: channelID,
						messageID: res.id,
					});
					logger.info(getCurrentTime()+': getUserRankings post verwijderd.');
				}, 20000); // delete after 20 sec

			} else {
				logger.info(err);
			}
		});
	});
}
	
	
	
	
	
function getCurrentTime(){
    var currentdate = new Date(); 
    var datetime = (currentdate.getMonth()+1) + "/"
            + currentdate.getDate() + "/"
            + currentdate.getFullYear() + " "  
            + currentdate.getHours() + ":"
            + currentdate.getMinutes() + ":" 
            + currentdate.getSeconds();
	return datetime;
}

function makeMillions(string) {
    return ("" + string).replace(/(\d)(?=(\d\d\d)+(?!\d))/g, function($1) { return $1 + "." });
}

function isNumeric(n) {
  return !isNaN(parseFloat(n)) && isFinite(n);
}

function getDayDifference(date2, date1) {    
    if (isEmpty(date1)) date1 = getCurTime();
    if (isEmpty(date2)) date2 = getCurTime();    
    var date1 = new Date(date1).getTime();
    var date2 = new Date(date2).getTime();
    var diffDays = parseInt((date2 - date1) / (1000 * 60 * 60 * 24)); 
    return diffDays;
}

function isEmpty(str) {
    if(typeof(str) == 'number' || typeof(str) == 'boolean') { 
        return false; 
    }
    if(typeof(str) == 'undefined' || str === null) {
        return true; 
    }
    if(typeof(str.length) != 'undefined') {
        return str.length == 0;
    }
    var count = 0;
    for(var i in str) {
        if(str.hasOwnProperty(i)) {
            count ++;
        }
    }
    return count == 0;
}

function getBadgeName(type){
    var badgetype='';
    if (type=='')			badgetype = 'XP';
    if (type=='battles')    badgetype = 'Battle Girl';
    if (type=='berries')    badgetype = 'Berry Master';
    if (type=='stops')      badgetype = 'Backpacker';
    if (type=='catches')    badgetype = 'Collector';
    if (type=='defended')   badgetype = 'Gym Leader';
    if (type=='raids')      badgetype = 'Champions';
    if (type=='legendary')  badgetype = 'Battle Legend';
    if (type=='gyms')  	 	badgetype = 'Golden Gyms';
    if (type=='evolves') 	badgetype = 'Scientist';
    if (type=='research') 	badgetype = 'Pokémon Ranger';
    return badgetype;
}

function calcLevel(xp) {

    var xpranges = [
        [0, 999],
        [1000, 2999],
        [3000, 5999],
        [6000, 9999],
        [10000, 14999],
        [15000, 20999],
        [21000, 27999],
        [28000, 35999],
        [36000, 44999],
        [45000, 54999],
        [55000, 64999],
        [65000, 74999],
        [75000, 84999],
        [85000, 99999],
        [10000, 119999],
        [120000, 139999],
        [140000, 159999],
        [160000, 184999],
        [185000, 209999],
        [210000, 259999],
        [260000, 334999],
        [335000, 434999],
        [435000, 559999],
        [560000, 709999],
        [710000, 899999],
        [900000, 1099999],
        [1100000, 1349999],
        [1350000, 1649999],
        [1650000, 1999999],
        [2000000, 2499999],
        [2500000, 2999999],
        [3000000, 3749999],
        [3750000, 4749999],
        [4750000, 5999999],
        [6000000, 7499999],
        [7500000, 9499999],
        [9500000, 11999999],
        [12000000, 14999999],
        [15000000, 19999999],
        [20000000, 999999999]
    ];

    for(var i = 0; i < xpranges.length; i++) {
        var xprange = xpranges[i];
        if (isBetween(xp, xprange[0], xprange[1])) var level = i;
    }
    return level+1;
}
        
function isBetween(n, a, b) {
    return (n - a) * (n - b) <= 0;
}

var contains = function(needle) {
    // Per spec, the way to identify NaN is that it is not equal to itself
    var findNaN = needle !== needle;
    var indexOf;

    if(!findNaN && typeof Array.prototype.indexOf === 'function') {
        indexOf = Array.prototype.indexOf;
    } else {
        indexOf = function(needle) {
            var i = -1, index = -1;
            for(i = 0; i < this.length; i++) {
                var item = this[i];
                if((findNaN && item !== item) || item === needle) {
                    index = i;
                    break;
                }
            }
            return index;
        };
    }
    return indexOf.call(this, needle) > -1;
};
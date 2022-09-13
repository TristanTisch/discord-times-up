const {Client, MessageEmbed} = require('discord.js');
const bot = new Client();


const token = 'Njk5MjQwNjU0NzE4NTAwOTQ0.XpRhSA.t5tGZaPHzkn0uNuOQNnKf1Ee0DY';

const PREFIX = '§';

//TODO Make sure that GameState always has all fields!!


bot.on('ready', () => {
	console.log('This bot is online.');
});
 
bot.on('message', handleMessage);

bot.login(token);


const fs = require('fs');
var channel;
const GameState = {
	STOPPED: 0,		//There is no game yet
	LOBBY: 	1,		//There is a game, but it wasnt started yet
	PLAYING: 2,		//There is a game currently running (this Game state is only active for a short time, mostly 3 & 4 are active)
	GET_READY: 3,	//The players are getting ready to guess
	GUESSING: 4,	//The players are guessing
}
Object.freeze(GameState);

var Game = {};

const embed = new MessageEmbed().setColor(0xe6dcc1);

//Handles a message of any type
function handleMessage(message) {
	if(message.channel.type === 'dm') {
			handleDMCommand(message)
	} else if(message.channel != channel && channel != undefined) {
		return;
	} else if (message.content.charAt(0) === PREFIX) {	
		channel = message.channel;
		//Split the message into command and args
		var args = message.content.substring(PREFIX.length).split(' ');
		if (args.length > 0) {
			handleCommand(message, args);
		} else {
			printNoCommandFound();
		}
	}
}

//Handles a message in a DM Channel
function handleDMCommand(message) {
	//We only continue if the message is not from us and the player exists
	if(!(message.author.id === bot.user.id) && playerExists((player) => {return player.user.id === message.author.id})) {
		switch(Game.state) {
			case GameState.LOBBY:
				handleLobby(message)
				break;
			case GameState.GET_READY:
				handleGetReady(message);
				break;
			case GameState.GUESSING:
				handleGuessing(message);
				break;
			default:
				message.channel.send(embed.setTitle('').setDescription('Gerade brauche ich keine Eingabe von dir. Lehne dich zurück :)'));
		}
	} else if (!(message.author.id === bot.user.id)){
		message.channel.send(embed.setTitle('').setDescription('Du bist in keinem Spiel.'));	
	}
}

//Handles a message if it is a command (starts with the prefix)
function handleCommand(message, args) {
	let command = args[0];
	switch (command) {
		case 'help': 
			printHelpMessage();
			break;
		case 'start':
			startGame();
			break;
		case 'stop':
			stopGame();
			break;
		case 'join':
			joinGame(message.author);
			break;
		case 'play':
			playGame();
			break;
		case 'time':
			setTime(args);
			break;
		case 'skip':
			handleSkip();
			break;
		default:
			printNoCommandFound();
	}
}

//Sets up a new Game and starts with the lobby phase
function startGame() {
	if (Game.state === GameState.STOPPED) {
		Game = {
			'cardsYetPlayed': [],
			'state': GameState.LOBBY,
			'players': [],
			'numCards': 2, 
			'round': 0,
			'time': 45,
		};
		
		channel.send(embed.setTitle('Spiel gestartet').setDescription("Neues Spiel gestarted. **" + PREFIX + "join** um beizutreten, **" + PREFIX + "play** um zu spielen."));
	} else {
		channel.send(embed.setTitle('Spiel läuft noch.').setDescription('Ein Spiel läuft gerade noch. Beende dieses zuerst mit **' + PREFIX + 'stop**, um ein neues Spiel zu starten zu können.'));
	}
}

//Stops a game if one is running
function stopGame() {
	if(Game.state === GameState.STOPPED) {
		channel.send(embed.setTitle('').setDescription("Es läuft momentan kein Spiel. Starte doch eins mit **" + PREFIX + "start**."));
	} else {
		Game.state = GameState.STOPPED;
		channel.send(embed.setTitle("Spiel beendet.").setDescription('Tschüss. Bis zum nächten Mal.'));
	}
}

//Lets a user join the game if it is in lobby phase
function joinGame(user) {
	if (Game.state === GameState.LOBBY) {
		if(playerExists((usr) => {return usr.user === user;})) {
			channel.send(embed.setTitle('').setDescription("Du bist bereits im Spiel."));
		} else {
			let team = (Game.players.length % 2 == 0)? 0 : 1;
			Game.players.push({
								'user': user,
								'team': team});
			const dmChannelPromise = user.createDM();
			dmChannelPromise.then(ch => {ch.send(embed.setTitle('Wilkommen zu Just One').setDescription(''))});
			channel.send(embed.setTitle('').setDescription(mentionUser(user.id) + ' ist nun im Spiel!'));
		}
	} else if (Game.state === GameState.STOPPED) {
		channel.send(embed.setTitle('').setDescription('Es läuft kein Spiel, dem du beitreten kannst. Erstelle eines mit **' + PREFIX + 'start**.'))
	}
}

//Really starts the game
function playGame() {
	var words = [];
	if(Game.state === GameState.LOBBY && Game.players.length >= 2) { //TODO 4 Spieler min.
		Game.state = GameState.PLAYING;
		/*----Uncomment this to read in words from a file (and add a '})' in line 202)---
		fs.readFile('./wordsNeu.txt', 'utf8', (err, data) => {
			if (err) {
				console.error(err)
				return
			}
		words = data.split(/\r?\n/g);*/
		words = Game.cardsYetPlayed
		Game.numCards = Game.cardsYetPlayed.length
		console.log(Game.cardsYetPlayed)
		//select numCards cards and save them in the game Object
		var cards = [];
		for(var i = 0; i < Game.numCards; i++) {
			let rand = Math.floor(Math.random() * words.length); //yields a random number between 0 and words.length-1 (inclusive)
			cards.push(words[rand]);
			words.splice(rand, 1);
		}
		//Set up the three card piles
		Game.cardsYetPlayed = [...cards];
		Game.solvedTeam0 = [];
		Game.solvedTeam1 = [];
		Game.cardsFailed = [];
		//The first player to join is the one chosing first (later incremented)
		Game.activePlayer = -1;
		Game.team0 = [];
		Game.team1 = [];
		

		let t0 = 'Team 0: \n';
		let t1 = 'Team 1: \n';
		for(let p of Game.players) {
			if(p.team === 1) {
				Game.team1.push(p);
				t1 += p.user.username + '\n';
			} else {
				Game.team0.push(p);
				t0 += p.user.username + '\n';
			}
		}

		channel.send(embed.setTitle('Spiel gestarted').setDescription('Los geht\'s! \n' + t0 + t1)).then(playRound);
		
	} else if (Game.state === GameState.LOBBY) {
		channel.send(embed.setTitle('Zu wenig Spieler').setDescription('Es müssen mindestens zwei Spieler mitspielen.'));
	} else {
		channel.send(embed.setTitle('').setDescription('Du kannst nur eine neue Runde spielen, wenn kein Spiel am Laufen ist und ein neues Spiel gestartet wurde.'));
	}
}

//Play one round
function playRound() {

	if(Game.solvedTeam0.length + Game.solvedTeam1.length == Game.numCards) {
		endGame();
		return;
	}

	//Setup the round
	Game.activePlayer = (Game.activePlayer + 1) % Game.players.length;
	Game.state = GameState.GET_READY;
	Game.round++;
	Game.pushActiveCard = true;
	channel.send(embed.setTitle('Runde ' + Game.round).setDescription('Der Tippgeber ist ' + mentionUser(Game.players[Game.activePlayer].user.id) + '. Team ' + Game.players[Game.activePlayer].team + ' muss raten.\n' + 
								'Restkarten: ' + Game.cardsYetPlayed.length + '\n' + 
								'Team 1: ' + Game.solvedTeam0.length + '\n' + 
								'Team 2: ' + Game.solvedTeam1.length));

	Game.players[Game.activePlayer].user.dmChannel.send(embed.setTitle('Bereit?').setDescription('Du bist der Erklärer in dieser Runde (Runde ' + Game.round + ').\n' + 
														'Du hast gleich ' + Game.time + ' Sekunden Zeit, um so viele Begriffe wie möglich zu erklären.\n' + 
														'Wenn dein team die Karte *erraten* hat, schreibe **j** (wie Ja).\n Wenn du die Karte *überspringen* möchtest, schreibe **n** (wie Nein).\n' + 
														'Wenn du *bereit* bist, schreibe **go**.'));
	Game.activeCard = Game.cardsYetPlayed.pop();
}

//Handles input during the phase where the active player is getting ready
function handleGetReady(message) {
	let p = retreivePlayer(message.author.id);
	if(Game.players[Game.activePlayer] === p && message.content === 'go') {
		Game.state = GameState.GUESSING;
		p.user.dmChannel.send(embed.setTitle('').setDescription('**' + Game.activeCard + '** (j/n)')).then(setTimeout(endGuessing, Game.time * 1000));
	} else if(Game.players[Game.activePlayer] === p) {
		p.user.dmChannel.send('Schreibe **go**, um zu starten.');
	}
}

//Is triggered after <Game.time> seconds to end the guessing phase
function endGuessing() {
	Game.players[Game.activePlayer].user.dmChannel.send('END!');
	if(Game.pushActiveCard) {
		Game.cardsYetPlayed.unshift(Game.activeCard);
	}
	while(Game.cardsFailed.length > 0) {
		Game.cardsYetPlayed.unshift(Game.cardsFailed.pop());
	}
	playRound();
}

function handleLobby(message) {
	let p = retreivePlayer(message.author.id);
	Game.cardsYetPlayed.push(message.content);
	p.user.dmChannel.send('Der Begriff ' + message.content + ' wurde gespeichert.');
}

function endGame() {
	channel.send(embed.setTitle('Restkarten: ' + Game.cardsYetPlayed.length + '\n' + 
								'Team 1: ' + Game.solvedTeam0.length + '\n' + 
								'Team 2: ' + Game.solvedTeam1.length));
	channel.send(embed.setTitle('').setDescription('Ich bereite euch eine neue Runde mit den selben Karten vor (für Ein-Wort oder Pantomime).\n' + 
													'Falls ihr mit neuen Karten spielen, oder aufhören wollt, beendet das Spiel mit **§stop**.'));
	//Karten mischen
	while(Game.solvedTeam0.length > 0 || Game.solvedTeam1.length > 0) {
		var index = Math.floor(Math.random() * Game.cardsYetPlayed.length + 1);
		if(Game.solvedTeam0.length > 0) {
			let c =  Game.solvedTeam0.pop();
			Game.cardsYetPlayed.splice(index, 0, c);
		} else {
			let c = Game.solvedTeam1.pop();
			Game.cardsYetPlayed.splice(index, 0, c);
		}
	}
	
	Game.round = -1;
	playRound();
}

function handleGuessing(message) {
	if(message.author === Game.players[Game.activePlayer].user) {
		if(message.content === 'j') {
			let t = retreivePlayer(message.author.id).team;
			//If there are still points to be awarded
			if(Game.solvedTeam0.length + Game.solvedTeam1.length < Game.numCards) {
				if(t == 0) {
					Game.solvedTeam0.push(Game.activeCard);
				} else {
					Game.solvedTeam1.push(Game.activeCard);
				}
			}
			if(Game.cardsYetPlayed.length > 0) {
				Game.activeCard = Game.cardsYetPlayed.pop();
				Game.players[Game.activePlayer].user.dmChannel.send(embed.setTitle('').setDescription('**' + Game.activeCard + '** (j/n)'));
			} else {
				Game.pushActiveCard = false;
				Game.players[Game.activePlayer].user.dmChannel.send(embed.setTitle('Stapel leer').setDescription('Es ist keine Karte mehr auf dem Nachziehstapel.'));
			}
		} else if(message.content === 'n') {
		//If there are still points to be awarded
			if(Game.solvedTeam0.length + Game.solvedTeam1.length < Game.numCards) {
				Game.cardsFailed.push(Game.activeCard);
			}
			if(Game.cardsYetPlayed.length > 0) {
				Game.activeCard = Game.cardsYetPlayed.pop();
				Game.players[Game.activePlayer].user.dmChannel.send(embed.setTitle('').setDescription('**' + Game.activeCard + '** (j/n)'));
			} else {
				Game.pushActiveCard = false;
				Game.players[Game.activePlayer].user.dmChannel.send(embed.setTitle('Stapel leer').setDescription('Es ist keine Karte mehr auf dem Nachziehstapel.'));
			}
		}
	}
}

function setTime(args) {
	if(args.length != 2) {
		channel.send(embed.setTitle('').setDescription('Benutzung: **' + PREFIX + 'time** ***<zeitInSekunden>***'));
	} else if(Game.state != GameState.GUESSING){
		Game.time = args[1]; //TODO parse int 
		channel.send(embed.setTitle('').setDescription('Zeit zum Raten auf ' + Game.time + ' Sekunden gesetzt.'));
	} else {
		channel.send(embed.setTitle('').setDescription('Die Zeit kann gerade nicht gesetzt werden.'));
	}
}


function handleSkip() {
	if(Game.state == GameState.GET_READY) {
		channel.send(embed.setTitle('').setDescription("Spieler übersprungen."))
		if(Game.pushActiveCard) {
			Game.cardsYetPlayed.unshift(Game.activeCard);
		}
		while(Game.cardsFailed.length > 0) {
			Game.cardsYetPlayed.unshift(Game.cardsFailed.pop());
		}
		playRound();
	}
}


//Prints a message with all the commands
function printHelpMessage() {
	//TODO print custom help message based on game state
	let m = 'Es existieren die folgenden Commands: \n' + 
			'' + PREFIX + 'start -> Startet ein neues Spiel \n' +
			'' + PREFIX + 'stop -> Beendet das gerade laufende Spiel \n' +
			'' + PREFIX + 'help -> Zeigt diese Hilfemitteilung \n' +
			'Du befindest dich im channel ' + mentionChannel(channel.id);
	channel.send(embed.setTitle('Hilfe!!').setDescription(m));
}

//Prints that the command was not found
function printNoCommandFound() {
	let m = 'Es gibt leider keinen solchen Command :/ \n' + 
			'Sende ' + PREFIX + 'help für alle Commands';
	channel.send(embed.setTitle('').setDescription(m));
}



//returns a String with that mentions the channel
function mentionChannel(channelID) {
	return '<#' + channelID + '>';
}

//returns a String with that mentions the user
function mentionUser(userID) {
	return '<@' + userID + '>';
}

//Returns true iff the predicate callback applies to one of the players
function playerExists(callback) {
	var exists = false;
	for(var i = 0; i < Game.players.length; i++) {
		if(callback(Game.players[i])) {
			exists = true;
		}
	}
	return exists;
}

//Returns the player with the given user id, if there is no such player null
function retreivePlayer(id) {
	for(var i = 0; i < Game.players.length; i++) {
		if(Game.players[i].user.id === id) {
			return Game.players[i];
		}
	}
	return null;
}
import 'package:flutter/material.dart';
import 'package:socket_io_client/socket_io_client.dart' as IO;
import 'package:hugeicons/hugeicons.dart';
import 'dart:typed_data';
import 'dart:convert';

void main()
{
    runApp(const MyApp());
}

class MyApp extends StatelessWidget
{
  const MyApp({super.key});

  @override
  Widget build(BuildContext context)
  {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'Kahoot',
      theme: ThemeData(
        primaryColor: Color(0xFF46178F),
        fontFamily: 'Kahoot-Regular'
        ),
      home : const GamePage(),
    );
  }

}


//game ke states
enum GameState {lobby, waiting, optionloading, option, answerloading, answerStatus, winnerScreen}

class GamePage extends StatefulWidget 
{
  const GamePage({super.key});

  @override
  State<GamePage> createState() => _GamePageState();
}

class _GamePageState extends State<GamePage> 
{

  bool isCorrect = false;
  int position = 4;
  int currentPoints = 0;
  int totalPoints = 0;
  int timer = 20;
  Uint8List? imageFile;

  GameState currentState = GameState.lobby;
  late IO.Socket socket;
  
  final TextEditingController pinController = TextEditingController();
  final TextEditingController nicknameController = TextEditingController();
  
  
  @override
  void initState() 
  {
    super.initState();
    initSocket();
  }
  

  void initSocket()
  {
    socket = IO.io('http://192.168.234.94:3000', IO.OptionBuilder() 
      .setTransports(['websocket'])
      .disableAutoConnect()
      .build()
    
    );
  
    socket.connect();  

    ///saare socket listener idhar aayenge
    ///states inke help se change honge
    ///which will call the requried widgets making 
    ///the final change in screen

    socket.on('pinError', (data)
    {
      showDialog(context: context, builder: (BuildContext context)
      {
        return Center(
          child: AlertDialog(
            title: Center(child: Text("No Room Found")),

            actionsAlignment: MainAxisAlignment.center,
            actions: <Widget>[
              TextButton(onPressed: (){
                Navigator.of(context).pop();
              }, child: Text("Okay"))
            ],
          ),
        );
      });
    });

    socket.on('joinedSuccess', (data) 
    {
      setState(() {
        currentState = GameState.waiting;
      });
    });


    socket.on('optionLoading', (data)
    {
      setState(() {
        currentState = GameState.optionloading;        
      });
    });

    socket.on('gameStarted',(data)
    {
      
      if(data['currentQuestion'] != null && data['currentQuestion']['image'] != null)
      {
        try
        {
          String Image = data['currentQuestion']['image'];
          if (Image.contains(',')) {
            Image = Image.split(',').last;
          }
          Image = Image.replaceAll(RegExp(r'\s+'), '');

          // 4. Fix Base64 padding (Dart requires the length to be a multiple of 4)
          int padding = Image.length % 4;
          if (padding != 0) {
            Image += '=' * (4 - padding);
          }
          imageFile = base64Decode(Image);
          
        }
        catch(error)
        {
          print(error);
          imageFile = null; 
        }
      }
      else
      {
        imageFile = null;
      }

      setState(() 
      {
        currentState = GameState.option;
      });
  });
    
    socket.on('answerSubmitted', (data)
    {
      setState(() {
        currentState = GameState.answerloading;
      });
    });


    socket.on('correctAnswer',(data)
    {
        setState(() {
          isCorrect = true;        
          currentPoints = data['points'];
          totalPoints = data['total'];
          currentState = GameState.answerStatus;
        });
    });
    socket.on('wrongAnswer',(data)
    {
      setState(() {
        isCorrect = false;
        totalPoints = data['total'];
        currentState = GameState.answerStatus;
      });
    });


    socket.on('positionUpdate',(data)
    {
      setState(() {
        position = data['i'];
      });
    });

    socket.on('gameEnded',(data)
    {
      setState(() {
        currentState = GameState.winnerScreen;
      });
    });


    socket.on('kicked', (data)=>
    {
      showDialog(context: context, builder: (BuildContext context)
      {
        return Center(
          child: AlertDialog(
            title: Center(child: Text("You were Kicked")),

            actionsAlignment: MainAxisAlignment.center,
            actions: <Widget>[
              TextButton(onPressed: (){
                Navigator.of(context).pop();
              }, child: Text("Okay"))
            ],
          ),
        );
      }),

      setState(() {
        currentState = GameState.lobby;
      })
    });
    socket.on('nicknameError',(data)
    {
      showDialog(context: context, builder: (BuildContext context)
      {
        return Center(
          child: AlertDialog(
            title: Center(child: Text("Nickname not unique")),

            actionsAlignment: MainAxisAlignment.center,
            actions: <Widget>[
              TextButton(onPressed: (){
                Navigator.of(context).pop();
              }, child: Text("Okay"))
            ],
          ),
        );
      });
    });
    socket.on('timerTick', (data)
    {
        if(mounted)
        {
          setState(() {
            timer = data;
          });
        }
    });
    socket.on('startedError',(data)
    {
      showDialog(context: context, builder: (BuildContext context)
      {
        return Center(
          child: AlertDialog(
            title: Center(child: Text("Game Already Started")),

            actionsAlignment: MainAxisAlignment.center,
            actions: <Widget>[
              TextButton(onPressed: (){
                Navigator.of(context).pop();
              }, child: Text("Okay"))
            ],
          ),
        );
      });
    });
  }


  void joinRequest()
  {
    String roomPin = pinController.text.trim();
    String nickname = nicknameController.text.trim();


    socket.emit('joinRoom',
    {
      'roomPin' : roomPin,
      'nickname': nickname
    });


  }
  


  ////saare widgets idhar honge
  @override
  Widget build(BuildContext context)
  {
    return Scaffold(
      body: Stack(
        children: [
          Positioned.fill(
            child: Opacity(
              opacity: 0.25,
              child: Image.asset(
                "assets/background.jpg",
                fit: BoxFit.cover,
              ),
            ),
          ),

          Positioned.fill(
            child: Container(
              color: Color(0xFF46178F).withValues(alpha: 0.35),
            ),
          ),

          Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: buildActiveView(),
            ),
          )
        ],
      ),
    );
  }

  Widget buildActiveView()
  {
    switch(currentState)
    {
      case GameState.lobby:
        return buildLobbyScreen();
      case GameState.waiting:
        return buildWaitingScreen();
      case GameState.optionloading:
        return buildOptionLoadingScreen();
      case GameState.option:
        return buildOptionScreen();
      case GameState.answerloading:
        return buildAnswerLoadingScreen();
      case GameState.answerStatus:
        return buildAnswerStatus();
      case GameState.winnerScreen:
        return buildWinnerScreen(position);
    }
  }

  Widget buildLobbyScreen() {
    return Card(
      elevation: 4,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 20.0, vertical: 30.0),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Image.asset(
              "assets/Kahoot-Logo.png",
              height: 60,
              fit: BoxFit.contain,
            ),
            const SizedBox(height: 20),
            Text(
              'Join Game',
              style: TextStyle(fontSize: 28, fontFamily: "Kahoot-Black", color: Color(0xFF46178F)),
            ),
            const SizedBox(height: 20),
            TextField(
              controller: pinController,
              keyboardType: TextInputType.number,
              textAlign: TextAlign.center,
              decoration: const InputDecoration(border: OutlineInputBorder(), hintText: 'Game PIN'),
              style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: nicknameController,
              textAlign: TextAlign.center,
              decoration: const InputDecoration(border: OutlineInputBorder(), hintText: 'Nickname'),
              style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: joinRequest,
              style: ElevatedButton.styleFrom(
                minimumSize: const Size.fromHeight(50),
                backgroundColor: Color(0xFF46178F)
              ),
              child: const Text('Enter', style: TextStyle(fontSize: 18, color: Colors.white)),
            ),
          ],
        ),
      ),
    );
  }

  Widget buildWaitingScreen() {
    return const Card(
      child: Padding(
        padding: EdgeInsets.all(40.0),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('You\'re in!', style: TextStyle(fontSize: 24, fontFamily: "Kahoot-Bold", color: Colors.green)),
            SizedBox(height: 12),
            Text('See your nickname on screen.', textAlign: TextAlign.center),
            SizedBox(height: 4),
            Text('Waiting for host to start...', textAlign: TextAlign.center),
            SizedBox(height: 20),
            CircularProgressIndicator(),
          ],
        ),
      ),
    );
  }

 Widget buildOptionScreen() {
    return Padding(
        padding: const EdgeInsets.all(8.0),
        
        child: Column(
          children: [
          if(imageFile != null)
            Expanded(
              child: Center(
                child: Padding(
                  padding: const EdgeInsets.only(bottom: 16),
                  child: Image.memory(
                    imageFile!,
                    fit: BoxFit.contain,
                  ),
                ),
              )
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(20),
              ),
              child: Text(
                '$timer',
                style: const TextStyle(
                  fontSize: 32, 
                  fontWeight: FontWeight.bold, 
                  color: Colors.black
                ),
              ),
            ),
            const SizedBox(height: 10),
            Expanded(
              child: Row(
                children: [
                  Expanded( 
                    child: GestureDetector( 
                      onTap: () {
                        socket.emit('submitAnswer',
                        {
                          'roomPin' : pinController.text.trim(),
                          'color' : 'Red'
                        });
                        setState(() {
                          currentState = GameState.answerloading;
                        });                        
                      },
                      child: Container(
                        width: double.infinity,
                        height: double.infinity,

                        margin: const EdgeInsets.all(6.0),
                        decoration: BoxDecoration(
                          color: Color(0xFFE21B3C),
                          borderRadius: BorderRadius.circular(12.0),
                        ),
                        child :Icon(  
                          Icons.change_history,
                          color :Colors.white
                        )
                      ),
                    ),  
                  ),

                  Expanded(
                    child: GestureDetector(
                      onTap: () {
                        socket.emit('submitAnswer',
                        {
                          'roomPin' : pinController.text.trim(),
                          'color' : 'Blue'
                        });   
                        setState(() {
                          currentState = GameState.answerloading;
                        });
                      },
                      child: Container(
                        width:double.infinity,
                        height:double.infinity,
                        margin: const EdgeInsets.all(6.0),
                        decoration: BoxDecoration(
                          color: Color(0xFF1368CE),
                          borderRadius: BorderRadius.circular(12.0),
                        ),
                        child:Icon(
                          Icons.diamond,
                          color : Colors.white
                        )
                      ),
                    ),
                  )
                ],
              ),
            ),
            
            Expanded(
              child: Row(
                children: [
                  Expanded(
                    child: GestureDetector(
                      onTap: () {
                        socket.emit('submitAnswer',
                        {
                          'roomPin' : pinController.text.trim(),
                          'color' : 'Yellow'
                        });   
                        setState(() {
                          currentState = GameState.answerloading;
                          
                        });
                      },
                      child: Container(
                        width: double.infinity,
                        height: double.infinity,
                        margin: const EdgeInsets.all(6.0),
                        decoration: BoxDecoration(
                          color: Color(0xFFFFA602),
                          borderRadius: BorderRadius.circular(12.0),
                        ),
                        child:Icon(
                          Icons.circle,
                          color:Colors.white
                        )
                      ),
                    ),
                  ),
                  
                  Expanded(
                    child: GestureDetector(
                      onTap: () {
                        socket.emit('submitAnswer',
                        {
                          'roomPin' : pinController.text.trim(),
                          'color' : 'Green'
                        });   
                        setState(() {
                          currentState = GameState.answerloading;
                          
                        });
                      },
                      child: Container(
                        width:double.infinity,
                        height:double.infinity,
                        margin: const EdgeInsets.all(6.0),
                        decoration: BoxDecoration(
                          color: Color(0xFF26890C),
                          borderRadius: BorderRadius.circular(12.0),
                        ),
                        child:Icon(
                          Icons.square,
                          color:Colors.white
                        )
                      ),
                    ),
                  )
                ],
              ),
            )
          ],
        ),
      );
  }
  
  Widget buildOptionLoadingScreen()
  {
    return Card(
      child: Padding(
        padding: EdgeInsets.all(40),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [

            Text(
              "Get Ready!",
              style: TextStyle(
                fontSize: 28,
                fontWeight: FontWeight.bold
              ),
            ),

            SizedBox(height:20),

            CircularProgressIndicator(),

            SizedBox(height:20),

            Text(
              "Waiting for next question..."
            )
          ],
        ),
      ),
    );
  }


  Widget buildAnswerLoadingScreen()
  {
    return AnswerLoadingWidget();
  }
  
  


  Widget buildAnswerStatus()
  {
    return Column(
          crossAxisAlignment : CrossAxisAlignment.center,
          mainAxisAlignment: MainAxisAlignment.center,
          
          children: [Text(
            isCorrect ? "Correct" : "Incorrect",
            style: TextStyle(
              color : Colors.white,
              fontSize: 40,
            ),
          ),
          HugeIcon(
            icon : isCorrect ? HugeIcons.strokeRoundedTick03 : HugeIcons.strokeRoundedMultiplicationSign,
            color : isCorrect? Colors.green : Colors.red,
            size: 48,
          ),
          SizedBox(height: 20),
          Text(
            "Your Position Now is",
            style: TextStyle(
              color : Colors.amber,
              fontSize: 25,

            ),
          ),
          SizedBox(height:5),
          Center(
            child: Text(
              "$position",
              style:TextStyle(
                color : Colors.amber,
                fontSize: 25
              )
            ),
          ),
          SizedBox(height : 20),

          SizedBox(
            width: 180,
            height: 90,
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 10),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      HugeIcon(
                        icon: HugeIcons.strokeRoundedAdd01,
                        color: Colors.teal,

                      ),

                      SizedBox(width: 3),

                      Text(
                        "$currentPoints",
                        style: TextStyle(
                          fontSize: 24,
                          fontFamily: "Kahoot-Bolds",
                          color: Colors.teal
                        ),
                      ),
                    ],
                  ),

                  SizedBox(height: 6),

                  Text(
                    "Total Points: $totalPoints",
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 20,
                      fontFamily: "Kahoot-Bold",
                      color: Colors.teal
                    ),
                  ),
                ],
              ),
            ),
          ),

          ],
        );
  }

  Widget buildWinnerScreen(int rank)
  {
    if(rank == 1)
    {
      return winnerLayout(
        iconWidget: HugeIcon(
          icon: HugeIcons.strokeRoundedLaurelWreathFirst02,
          color: Colors.amber,
          size: 120,
        ),
        title : "First Place!!!"
      );
    }
    
    if(rank == 2)
    {
      return winnerLayout(
        iconWidget: HugeIcon(
          icon : HugeIcons.strokeRoundedMedalSecondPlace,
          size: 120,
          color: Color.fromARGB(255, 221, 219, 219),
        ),
        title : "Second Place!!!"
      );
    }
    
    if(rank == 3)
    {
      return winnerLayout(
        iconWidget: HugeIcon(
          icon : HugeIcons.strokeRoundedStarAward02,
          size: 120,
          color: Color.fromARGB(107, 121, 47, 24),
        ),
        title : "Third Place!!!"
      );
    }
    return loserLayout();
  }

Widget winnerLayout({
  required String title,
  required Widget iconWidget,
}) {
  return Center(
    child: Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        iconWidget,

        SizedBox(height: 20),

        Text(
          title,
          style: TextStyle(
            fontSize: 32,
            fontWeight: FontWeight.bold,
          ),
        ),
        SizedBox(height: 20),
        Text(
          "Your Points are $totalPoints",
          style: TextStyle(
            color: Colors.teal
          ),
        )
      ],
    ),
  );
}

Widget loserLayout() {
  return Center(
    child: Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        HugeIcon(
          icon : HugeIcons.strokeRoundedDiploma,
          size: 80,
          color: Color(0xFFD1E8E2),
        ),

        SizedBox(height: 20),

        Text(
          "Game Finished, your position is $position",
          style: TextStyle(fontSize: 28),
        ),
        SizedBox(height: 20),
        Text(
          "Your points are $totalPoints",
          style: TextStyle(
            color: Colors.teal
          ),
        )
      ],
    ),
  );
}

@override
  void dispose() {
    // TODO: implement dispose
    super.dispose();
    socket.dispose();
    pinController.dispose();
    nicknameController.dispose();
  }
}


class AnswerLoadingWidget extends StatelessWidget {
  const AnswerLoadingWidget({super.key});

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 4,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: const Padding(
        padding: EdgeInsets.all(40.0),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.check_circle_outline,
              size: 60,
              color: Colors.green,
            ),
            SizedBox(height: 20),
            Text(
              'Answer Transmitted!',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: Colors.indigo),
            ),
            SizedBox(height: 16),
            Text(
              'Waiting for other players to finish, or for the clock to run down...',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 16, color: Colors.black87),
            ),
            SizedBox(height: 32),
            // Indeterminate loader (spins infinitely until server changes the state)
            CircularProgressIndicator(
              color: Color(0xFF46178F),
              strokeWidth: 6,
            ),
          ],
        ),
      ),
    );
  }
}
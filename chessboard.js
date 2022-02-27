"use strict";

// 对局结果
var RESULT_UNKNOWN = 0;	// 未知
var RESULT_WIN = 1;		// 赢
var RESULT_DRAW = 2;	// 和棋
var RESULT_LOSS = 3;	// 输

var BOARD_WIDTH = 521;
var BOARD_HEIGHT = 577;
var SQUARE_SIZE = 57;
var SQUARE_LEFT = (BOARD_WIDTH - SQUARE_SIZE * 9) >> 1;
var SQUARE_TOP = (BOARD_HEIGHT - SQUARE_SIZE * 10) >> 1;
var THINKING_SIZE = 32;
var THINKING_LEFT = (BOARD_WIDTH - THINKING_SIZE) >> 1;
var THINKING_TOP = (BOARD_HEIGHT - THINKING_SIZE) >> 1;
var ANIMATION_STEP = 8;
var PIECE_NAME = [
  "oo", null, null, null, null, null, null, null,
  "rk", "ra", "rb", "rn", "rr", "rc", "rp", null,
  "bk", "ba", "bb", "bn", "br", "bc", "bp", null,
];

// 棋子距离棋盘左边框的距离
function SQ_X(sq) {
  return SQUARE_LEFT + (COL_X(sq) - 3) * SQUARE_SIZE;
}

// 棋子距离棋盘上边框的距离
function SQ_Y(sq) {
  return SQUARE_TOP + (ROW_Y(sq) - 3) * SQUARE_SIZE;
}

function MOVE_PX(src, dst, step) {
  return Math.floor((src * step + dst * (ANIMATION_STEP - step)) / ANIMATION_STEP + .5) + "px";
}

function sendMSG(message) {
  setTimeout(function() {
    alert(message);
  }, 300);
}

function Board(container, images, stateList) {
  this.images = images;			// 图片路径
  this.stateList = stateList;
  this.imgSquares = [];			// img数组，对应棋盘上的90个位置区域
  this.pos = new Position();
  this.pos.fromFen("rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w - - 0 1");	// 根据FEN串初始化棋局
  this.sqSelected = 0;			// 当前选中棋子的位置（如果为0，表示当前没有棋子被选中）
  this.mvLast = 0;				// 上一步走法
  this.search = null;			// Search对象的实例
  this.computer = -1;			// this.computer = 0，表示电脑执黑；this.computer = 1，表示电脑执红
  this.result = RESULT_UNKNOWN;	// 对局结果
  this.busy = false;			// false-空闲状态；true-繁忙状态，不再响应用户点击。

  var style = container.style;
  style.position = "relative";
  style.width = BOARD_WIDTH + "px";
  style.height = BOARD_HEIGHT + "px";
  style.background = "url(" + images + "board.jpg)";
  var this_ = this;
  for (var sq = 0; sq < 256; sq ++) {
    // 遍历虚拟棋盘的256个点
	
	// 1.判断该点是否位于真实棋盘
	if (!IN_BOARD(sq)) {
      this.imgSquares.push(null);
      continue;
    }
	
	// 2.棋盘上的90个区域，每个区域都会定义一个对应的img标签
    var img = document.createElement("img");
    var style = img.style;
    style.position = "absolute";
    style.left = SQ_X(sq) + "px";
    style.top = SQ_Y(sq) + "px";
    style.width = SQUARE_SIZE + "px";
    style.height = SQUARE_SIZE + "px";
    style.zIndex = 0;
	
	// 3.每个棋盘区域都会绑定点击事件，参数sq_表示了具体点击的区域。（这里用到了“闭包”的知识吧）
    img.onmousedown = function(sq_) {
      return function() {
        this_.clickCross(sq_);
      }
    } (sq);

	// 4.将定义好的img标签追加到html中
    container.appendChild(img);
	
	// 5.将img标签存储到imgSquares数组中，方便后续对该区域进行操作（比如，显示不同的棋子图片）
	this.imgSquares.push(img);
  }
  
  // 电脑思考中的图片（也就是thinking.gif）
  this.thinking = document.createElement("img");
  this.thinking.src = images + "thinking.gif";
  style = this.thinking.style;
  style.visibility = "hidden";
  style.position = "absolute";
  style.left = THINKING_LEFT + "px";
  style.top = THINKING_TOP + "px";
  container.appendChild(this.thinking);

  // 显示棋子图片
  this.paintBoard();
}

// 设置搜索算法
Board.prototype.setSearch = function() {
  this.search = new Search(this.pos);
}

// 翻转棋盘位置（电脑执红，也就是电脑先走的时候，会把红棋显示在棋盘上面，黑棋显示在下面）
Board.prototype.flipped = function(sq) {
  return this.computer == 0 ? SQUARE_SYMMETRIC(sq) : sq;
}

// 如果该电脑走棋，返回true；否则，返回false
Board.prototype.computerMove = function() {
  return this.pos.sdPlayer == this.computer;
}

// 判断这步棋是否合法，如果合法，就执行这步棋
Board.prototype.addMove = function(mv, computerMove) {
  // console.log(mv);
  // 判断这步棋是否合法
  if (!this.pos.legalMove(mv)) {
    return;
  }
  
  // 执行这步棋
  if (!this.pos.makeMove(mv)) {
    return;
  }

  this.busy = true;
  
  // this.postAddMove(mv, computerMove);

  var sqSrc = this.flipped(SRC(mv));
  var xSrc = SQ_X(sqSrc);
  var ySrc = SQ_Y(sqSrc);
  var sqDst = this.flipped(DST(mv));
  var xDst = SQ_X(sqDst);
  var yDst = SQ_Y(sqDst);
  var style = this.imgSquares[sqSrc].style;
  style.zIndex = 256;
  var step = ANIMATION_STEP - 1;
  var this_ = this;
  var timer = setInterval(function() {
    if (step == 0) {
      clearInterval(timer);
      style.left = xSrc + "px";
      style.top = ySrc + "px";
      style.zIndex = 0;
      this_.postAddMove(mv, computerMove);
    } else {
      style.left = MOVE_PX(xSrc, xDst, step);
      style.top = MOVE_PX(ySrc, yDst, step);
      step --;
    }
  }, 16);  
}

Board.prototype.postAddMove = function(mv, computerMove) {
  // 清除上一步的选中方框
  if (this.mvLast > 0) {
    this.drawCross(SRC(this.mvLast), false);
    this.drawCross(DST(this.mvLast), false);
  }
 
 // 显示这一步走棋的选中方框
  this.drawCross(SRC(mv), true);
  this.drawCross(DST(mv), true);
  
  this.sqSelected = 0;
  this.mvLast = mv;
  
  // 判断游戏是否结束
  if (this.pos.gameOver()) {	// 无棋可走，实际上就是被将死了
    this.result = computerMove ? RESULT_LOSS : RESULT_WIN;
    sendMSG(computerMove ? "请再接再厉！" : "祝贺你取得胜利！");
    this.busy = false;
    return;
  }
  
  // 判断是否出现长将
  var vlRep = this.pos.repStatus(2);
  if (vlRep > 0) {
    vlRep = this.pos.repValue(vlRep);
    if (vlRep > -WIN_VALUE && vlRep < WIN_VALUE) {
      this.result = RESULT_DRAW;
      sendMSG("双方重复作和，辛苦了！");
    } else if (computerMove == (vlRep < 0)) {
      this.result = RESULT_LOSS;
      sendMSG("单方长将作负，请不要气馁！");
    } else {
      this.result = RESULT_WIN;
      sendMSG("单方长将作负，恭喜您取得胜利！");
    }
    this.busy = false;
    return;
  }
  

  var hasMaterial = false;
  for (var sq = 0; sq < 256; sq++) {
    if (IN_BOARD(sq) && (this.pos.squares[sq] & 7) > 2) {
      hasMaterial = true;
      break;
    }
  }
  if (!hasMaterial) {
    this.result = RESULT_DRAW;
    sendMSG("双方都没有进攻棋子了。作和，辛苦了！");
    this.busy = false;
    return;
  }
  if (this.pos.pcList.length > 121) {
    var captured = false;
    for (var i = 2; i <= 120; i ++) {
      if (this.pos.pcList[this.pos.pcList.length - i] > 0) {
        captured = true;
        break;
      }
    }
    if (!captured) {
      this.result = RESULT_DRAW;
      sendMSG("超过自然限着没有吃子。作和，辛苦了！");
      this.busy = false;
      return;
    }
  }

  // 电脑回一步棋
  this.response();
}

// 电脑出一步棋
Board.prototype.response = function() {
  if (this.search == null || !this.computerMove()) {	// 搜索对象为null或者不该电脑走棋
    this.busy = false;
    return;
  }
  this.thinking.style.visibility = "visible";			// 显示电脑思考中的图片
  var this_ = this;
  var mvResult = 0;
  this.busy = true;
  setTimeout(function() {
    board.time = 1000;
    this_.addMove(board.search.searchID(LIMIT_DEPTH, board.time), true);
    this_.thinking.style.visibility = "hidden";
    var state = document.createElement("option");
    state.selected = true;
    state.value = "d" + new Date().getTime();
    state.text = "搜索深度：" + board.search.lastTryDepth;
    this.stateList.appendChild(state);
    state = document.createElement("option");
    state.selected = true;
    state.value = "n" + new Date().getTime();
    state.text = "搜索点数：" + board.search.lastTryNodes;
    this.stateList.appendChild(state);
    this.stateList.appendChild(state);
    state = document.createElement("option");
    state.selected = true;
    state.value = "v" + new Date().getTime();
    state.text = "优势估计：" + board.search.bestValue;
    this.stateList.appendChild(state);
  }, 250);
}

// 点击棋盘的响应函数。点击棋盘（棋子或者空位置），就会调用该函数。sq_是点击的位置
Board.prototype.clickCross = function(sq_) {
  if (this.busy || this.result != RESULT_UNKNOWN) {
    return;
  }
  var sq = this.flipped(sq_);		// 点击的位置（如果是电脑执红，位置是被翻转的。再执行一遍flipped，位置就被翻转回来了。）
  var pc = this.pos.squares[sq];	// 点击的棋子
  if ((pc & SIDE_TAG(this.pos.sdPlayer)) != 0) {
    // 点击了己方棋子，直接选中该子
	
	if (this.mvLast != 0) {
      this.drawCross(SRC(this.mvLast), false);
      this.drawCross(DST(this.mvLast), false);
    }
    if (this.sqSelected) {
      this.drawCross(this.sqSelected, false);
    }
    this.drawCross(sq, true);
    this.sqSelected = sq;
  } else if (this.sqSelected > 0) {
    // 点击的不是己方棋子（对方棋子或者无子的位置），但有子选中了(一定是自己的子)，那么执行这个走法
    this.addMove(MOVE(this.sqSelected, sq), false);
  }
}

// 显示sq位置的棋子图片。如果该位置没棋子，则显示一张透明的图片。如果selected为true，则要显示棋子选中时的边框。
Board.prototype.drawCross = function(sq, selected) {
  var img = this.imgSquares[this.flipped(sq)];
  img.src = this.images + PIECE_NAME[this.pos.squares[sq]] + ".gif";
  img.style.backgroundImage = selected ? "url(" + this.images + "oos.gif)" : "";
}

// 重新显示棋盘上的棋子
Board.prototype.paintBoard = function() {
  for (var sq = 0; sq < 256; sq ++) {
    if (IN_BOARD(sq)) {
      this.drawCross(sq);
    }
  }
}

// 棋局重新开始
Board.prototype.restart = function(fen) {
  if (this.busy) {				// 电脑正在思考中，不响应任何点击事件
    return;
  }

  this.result = RESULT_UNKNOWN;	// 重置对局结果为“未知”
  this.pos.fromFen(fen);		// 根据用户选择的局面重新开始
  this.paintBoard();			// 重新显示棋盘
  this.response();				// 如果电脑执红先走，会自动走步棋。
}

// 悔棋
Board.prototype.retract = function() {
  if (this.busy) {
    return;
  }

  // 重置对局结果为“未知”
  this.result = RESULT_UNKNOWN;
  
  // 如果走法数组不为空，那么就撤销一步棋
  if (this.pos.mvList.length > 1) {
    this.pos.undoMakeMove();
  }
  
  // 如果走法数组不为空，并且该电脑走棋，那么需要再撤销一步棋
  if (this.pos.mvList.length > 1 && this.computerMove()) {
    this.pos.undoMakeMove();
  }
  
  this.paintBoard();
  this.response();
}

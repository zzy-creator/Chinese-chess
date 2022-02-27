"use strict";

function arraySortByKey(mvs, vls) {//对所有走法mvs按照历史表的评估值vls进行快速排序 这样从底层实现常数较小
  var te;
  var pi;
  var quickSort = function(l, r){
    pi = vls[(l + r) >> 1];
    var i = l;
    var j = r;
    while (i <= j){
      while (vls[i] > pi) ++i;
      while (vls[j] < pi) --j;
      if (i <= j){
        if (i < j){
          te = vls[i];
          vls[i] = vls[j];
          vls[j] = te;
          te = mvs[i];
          mvs[i] = mvs[j];
          mvs[j] = te;   
        }    
        ++i;
        --j; 
      }
    }
    if (l < i - 1) {
      quickSort(l, i - 1);
    }
    if (i < r) {
      quickSort(i, r);
    }
  }
  if (mvs.length > 1) quickSort(0, mvs.length - 1);
}

// 对走法排序
function MoveSort(pos, historyTable) {
  this.mvs = [];										// 走法数组，存储当前局面所有走法
  this.vls = [];										// 在历史表中，每个走法对应的分值
  this.pos = pos;
  this.historyTable = historyTable;
  this.index = 0;

  var movesAll = pos.generateMoves();					// 生成全部走法
  for (var i = 0; i < movesAll.length; i ++) {
    var mv = movesAll[i]
    if (!pos.makeMove(mv))
      continue;
    pos.undoMakeMove();
    this.mvs.push(mv);
    this.vls.push(historyTable[mv]);	// 获取历史表中，该走法的值
  }
  arraySortByKey(this.mvs, this.vls);						// 根据历史表的分值，对走法进行排序
}

// 获得一步排序后的走法。如果走法已经全部获取，则返回0
MoveSort.prototype.next = function() {
  if (this.index < this.mvs.length)
    return this.mvs[this.index++];
  return 0;
}

var LIMIT_DEPTH = 60;	// 最大搜索深度

function Search(pos) {
  this.pos = pos;
}

// 更新历史表
Search.prototype.setHistoryMove = function(mv, depth) {
  this.historyTable[mv] += depth * depth;
}

// 迭代加深搜索
Search.prototype.searchID = function(depth, millis) {
  this.historyTable = new Array(65536).fill(0);
  
  this.mvResult = 0; 			// 搜索出的走法
  this.pos.distance = 0;		// 初始化搜索深度
  var t = new Date().getTime();	// 当前距离1970-01-01的毫秒数

  this.lastTryNodes = 0;
 // 迭代加深搜索
  for (var i = 1; i <= depth; i ++) {
    // console.log("dfs" + i);
    var vl = this.search(-MATE_VALUE, MATE_VALUE, i);
    // console.log(vl);
    this.allMillis = new Date().getTime() - t;	// 已经花费的时间
    if (this.allMillis > millis) {				// 时间用完了，不用继续搜索
      break;
    }
    if (vl > WIN_VALUE || vl < -WIN_VALUE) {	// 胜负已分，不用继续搜索
      break;
    }
  }
  this.lastTryDepth = i;
  return this.mvResult;
}

// Alpha-Beta搜索
Search.prototype.search = function(Alpha, Beta, depth) {
  ++this.lastTryNodes;

  // 到达最深深度，返回局面评价值
  if (depth <= 0) {
    // 检查重复局面 
    var vlRep = this.pos.repStatus(2);
    if (vlRep > 0) 
      return this.pos.repValue(vlRep);
    return this.pos.evaluate();
  }

  // 检查重复局面 
  var vlRep = this.pos.repStatus(2);
  if (vlRep > 0) 
    return this.pos.repValue(vlRep);

  // 初始化最佳值和最佳走法
  var vlBest = -MATE_VALUE;	// 这样可以知道，是否一个走法都没走过(杀棋)
  var mvBest = 0;			// 这样可以知道，是否搜索到了Beta截断或PV走法，以便保存到历史表

  // 生成全部走法，并根据历史表排序
  var sort = new MoveSort(this.pos, this.historyTable);
  
  // 逐一走这些走法，并进行递归
  var mv = 0;
  var vl = 0;
  while ((mv = sort.next()) > 0) {
	  if (!this.pos.makeMove(mv)) 
	    continue;

    vl = -this.search(-Beta, -Alpha, depth - 1);	// 递归调用，注意有三个负号
    this.pos.undoMakeMove();
	
	// 进行Alpha-Beta大小判断和截断
    if (vl > vlBest) {		// 找到最佳值
      vlBest = vl;			// "vlBest"就是目前要返回的最佳值，可能超出Alpha-Beta边界
      if (vl >= Beta) {	// 找到一个Beta走法
        mvBest = mv;		// Beta走法要保存到历史表
        break;				// Beta截断
      }
      if ((vl > Alpha) || ((vl == Alpha) && (Math.random() > Math.random()))) {	// 找到一个最好的走法
        Alpha = vl;		// 缩小Alpha-Beta边界
        mvBest = mv;		// 当前走法要保存到历史表
        if (this.pos.distance == 0) {	// 回到了根节点，记录根节点的最佳走法
          this.mvResult = mv;
          this.bestValue = vl;
        }
      }
    }
  }
  
  // 所有走法都搜索完了，把最佳走法(不能是Alpha走法)保存到历史表，返回最佳值
  if (vlBest == -MATE_VALUE) 	// 是杀棋
    // 根据杀棋步数给出评价
    return this.pos.winValue();

  if (mvBest > 0) //用当前最好的走法更新历史表
    this.setHistoryMove(mvBest, depth);

  return vlBest;
}

// constants
const states = Object.freeze({
  canvas: $("#graph-canvas"),
  rowCountInput: $("#row-count"),
  columnCountInput: $("#column-count"),
  boxSizeInput: $("#box-size"),
  toolModeInput: $("input[name=selectionMode]:radio"),
  clearGraphBtn: $("#clear-graph-btn"),
  startStopBtn: $("#start-stop-btn"),
  width: $("#graph-canvas").width(),
  height: $("#graph-canvas").height(),
  actionPanel: $("#action-panel")
});

const COLORS = Object.freeze({
  BOX_BORDER_COLOR: "#192965",
  BOX_TYPE_BLOCK_COLOR: "#192965",
  BOX_TYPE_CLEAR_COLOR: "#fff",
  BOX_TYPE_START_NODE_COLOR: "#007bff",
  BOX_TYPE_END_NODE_COLOR: "#f0134d",
  BOX_TYPE_TRAVERSED_NODE_COLOR: "#c3f0ca",
  BOX_TYPE_PATH_NODE_COLOR: "#3fc5f0",
  BOX_TYPE_ERROR_NODE_COLOR: "#6c757d"
});

const DEFAULT_BOX_SIZE = 30;
const MAX_END_NODE_COUNT = 3;

const BOX_TYPES = Object.freeze({
  BLOCK: 0,
  CLEAR: 1,
  START_NODE: 2,
  END_NODE: 3,
  TRAVERSED_NODE: 4,
  PATH_NODE: 5,
  ERROR_NODE: 6
});

const TOOL_MODE = Object.freeze({
  WALL_NODES: 0,
  START_NODE: 1,
  TARGET_NODE: 2
});

let ACTION_TOOL_MODE = TOOL_MODE.WALL_NODES;
let START_NODE = null;
let END_NODE = null;
let ActiveGrid = null;

// utilities
function uuidv4() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(c) {
    var r = (Math.random() * 16) | 0,
      v = c == "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// classes

class GraphNode {
  constructor(value, id = uuidv4()) {
    this.id = id;
    this.value = value;
    this.__adjacent = new Set();
  }

  joinAdjacentNode(node) {
    if (node instanceof GraphNode) {
      this.__adjacent.add(node);
    }
  }

  removeAdjacentNode(node) {
    if (node instanceof GraphNode && this.__adjacent.has(node)) {
      this.__adjacent.delete(node);
    }
  }

  get adjacents() {
    return this.__adjacent;
  }
}

class GraphMatrix {
  constructor(rowCount, columnCount, nodeCls) {
    this.rowCount = rowCount;
    this.columnCount = columnCount;
    this.__processed = false;
    this.nodeCls = nodeCls;
    this.__nodes = [];
  }

  generateNodes() {
    for (let r = 0; r < this.rowCount; r++) {
      const temp_row_nodes = [];
      for (let c = 0; c < this.columnCount; c++) {
        const node = new this.nodeCls([r, c]);
        temp_row_nodes.push(node);
      }
      this.__nodes.push(temp_row_nodes);
    }
  }

  joinAdjacent(r, c) {
    const top = r > 0 ? this.nodes[r - 1][c] : null;
    const left = c > 0 ? this.nodes[r][c - 1] : null;
    const bottom = r < this.rowCount - 2 ? this.nodes[r + 1][c] : null;
    const right = c < this.columnCount - 2 ? this.nodes[r][c + 1] : null;
    this.nodes[r][c].joinAdjacentNode(top);
    this.nodes[r][c].joinAdjacentNode(left);
    this.nodes[r][c].joinAdjacentNode(bottom);
    this.nodes[r][c].joinAdjacentNode(right);
    top != null ? top.joinAdjacentNode(this.nodes[r][c]) : null;
    left != null ? left.joinAdjacentNode(this.nodes[r][c]) : null;
    bottom != null ? bottom.joinAdjacentNode(this.nodes[r][c]) : null;
    right != null ? right.joinAdjacentNode(this.nodes[r][c]) : null;
  }

  removeAdjacent(r, c) {
    const top = r > 0 ? this.nodes[r - 1][c] : null;
    const left = c > 0 ? this.nodes[r][c - 1] : null;
    const bottom = r < this.rowCount - 2 ? this.nodes[r + 1][c] : null;
    const right = c < this.columnCount - 2 ? this.nodes[r][c + 1] : null;
    this.nodes[r][c].removeAdjacentNode(top);
    this.nodes[r][c].removeAdjacentNode(left);
    this.nodes[r][c].removeAdjacentNode(bottom);
    this.nodes[r][c].removeAdjacentNode(right);
    top != null ? top.removeAdjacentNode(this.nodes[r][c]) : null;
    left != null ? left.removeAdjacentNode(this.nodes[r][c]) : null;
    bottom != null ? bottom.removeAdjacentNode(this.nodes[r][c]) : null;
    right != null ? right.removeAdjacentNode(this.nodes[r][c]) : null;
  }

  generateMatrix() {
    for (let r = 0; r < this.rowCount; r++) {
      for (let c = 0; c < this.columnCount; c++) {
        this.joinAdjacent(r, c);
      }
    }
  }

  process() {
    this.generateNodes();
    this.generateMatrix();
    this.__processed = true;
  }

  get isProcessed() {
    return this.__processed;
  }

  get nodeCount() {
    return this.rowCount * this.columnCount;
  }

  get nodes() {
    return this.__nodes;
  }
}

// paper js related
class Box extends GraphNode {
  constructor(value, id) {
    super(value, id);
    this.pointTL = null;
    this.pointBR = null;
    this.nodeType = BOX_TYPES.CLEAR;
    this.__path = null;
  }

  setAsStart() {
    this.nodeType = BOX_TYPES.START_NODE;
    this.__path.fillColor = COLORS.BOX_TYPE_START_NODE_COLOR;
  }

  removeAsStart() {
    if (this.nodeType == BOX_TYPES.START_NODE) {
      this.nodeType = BOX_TYPES.CLEAR;
      this.__path.fillColor = COLORS.BOX_TYPE_CLEAR_COLOR;
    }
  }

  setAsEnd() {
    this.nodeType = BOX_TYPES.END_NODE;
    this.__path.fillColor = COLORS.BOX_TYPE_END_NODE_COLOR;
  }

  removeAsEnd() {
    if (this.nodeType == BOX_TYPES.END_NODE) {
      this.nodeType = BOX_TYPES.CLEAR;
      this.__path.fillColor = COLORS.BOX_TYPE_CLEAR_COLOR;
    }
  }

  setAsClear() {
    this.nodeType = BOX_TYPES.CLEAR;
    this.__path.fillColor = COLORS.BOX_TYPE_CLEAR_COLOR;
  }

  setAsBlock() {
    this.nodeType = BOX_TYPES.BLOCK;
    this.__path.fillColor = COLORS.BOX_TYPE_BLOCK_COLOR;
  }

  setAsTraversed() {
    if (this.nodeType == BOX_TYPES.BLOCK) {
      this.nodeType = BOX_TYPES.ERROR_NODE;
      this.__path.fillColor = COLORS.BOX_TYPE_ERROR_NODE_COLOR;
    } else {
      this.nodeType = BOX_TYPES.TRAVERSED_NODE;
      this.__path.fillColor = COLORS.BOX_TYPE_TRAVERSED_NODE_COLOR;
    }
  }

  resetTraversed() {
    if (
      this.nodeType == BOX_TYPES.TRAVERSED_NODE ||
      this.nodeType == BOX_TYPES.PATH_NODE
    ) {
      this.setAsClear();
    }
  }

  setAsFront() {
    this.nodeType = BOX_TYPES.TRAVERSED_NODE;
    this.__path.fillColor = "#000";
  }

  getFillColor() {
    switch (this.nodeType) {
      case BOX_TYPES.BLOCK:
        return COLORS.BOX_TYPE_BLOCK_COLOR;
      case BOX_TYPES.CLEAR:
        return COLORS.BOX_TYPE_CLEAR_COLOR;
      case BOX_TYPES.START_NODE:
        return COLORS.BOX_TYPE_START_NODE_COLOR;
      case BOX_TYPES.END_NODE:
        return COLORS.BOX_TYPE_END_NODE_COLOR[0];
    }
  }

  setPoints(pointTL, pointBR) {
    this.pointTL = pointTL;
    this.pointBR = pointBR;
  }

  draw() {
    this.__path = new Path.Rectangle(this.pointTL, this.pointBR);
    this.__path.strokeColor = COLORS.BOX_BORDER_COLOR;
    this.__path.fillColor = this.getFillColor();
    this.__path.strokeWidth = 0.3;
  }

  get path() {
    return this.__path;
  }
}

class Grid {
  constructor(width, height, graph, boxSize) {
    this.width = width;
    this.height = height;
    this.graph = graph;
    this.boxSize = boxSize;
    this.__dragEnabled = false;
    this.__runner = null;
    this.onStartEndSet = () => {};
    this.onRunnerStop = () => {};
    this.onRunnerStart = () => {};
  }

  getBoxSideLength() {
    const area = this.width * this.height;
    const singleBoxArea = area / this.graph.nodeCount;
    const singleBoxSideLength = Math.sqrt(singleBoxArea);
    console.log(singleBoxSideLength);
    return singleBoxSideLength;
  }

  perfromAction(r, c) {
    switch (ACTION_TOOL_MODE) {
      case TOOL_MODE.START_NODE:
        START_NODE = [r, c];
        this.setStart();
        break;
      case TOOL_MODE.TARGET_NODE:
        END_NODE = [r, c];
        this.setEnd();
        break;
      case TOOL_MODE.WALL_NODES:
        if (this.boxes[r][c].nodeType == BOX_TYPES.BLOCK) {
          this.setClear(r, c);
        } else {
          this.setBlock(r, c);
        }
        break;
    }
  }

  addEvents(box, r, c) {
    const self = this;
    box.path.onMouseDown = function(event) {
      self.__dragEnabled = true;
      self.perfromAction(r, c);
    };
    box.path.onMouseUp = function(event) {
      self.__dragEnabled = false;
    };
    box.path.onMouseEnter = function(event) {
      this.selected = true;
      if (self.__dragEnabled) {
        self.perfromAction(r, c);
      }
    };
    box.path.onMouseLeave = function(event) {
      this.selected = false;
    };
  }

  setBlock(r, c) {
    this.graph.removeAdjacent(r, c);
    this.boxes[r][c].setAsBlock();
  }
  setClear(r, c) {
    this.graph.joinAdjacent(r, c);
    this.boxes[r][c].setAsClear();
  }

  setStart() {
    for (let r = 0; r < this.graph.rowCount; r++) {
      for (let c = 0; c < this.graph.columnCount; c++) {
        this.boxes[r][c].removeAsStart();
      }
    }
    this.boxes[START_NODE[0]][START_NODE[1]].setAsStart();
    this.onStartEndSet();
  }

  resetTraversal() {
    for (let r = 0; r < this.graph.rowCount; r++) {
      for (let c = 0; c < this.graph.columnCount; c++) {
        this.boxes[r][c].resetTraversed();
      }
    }
  }

  setEnd() {
    for (let r = 0; r < this.graph.rowCount; r++) {
      for (let c = 0; c < this.graph.columnCount; c++) {
        this.boxes[r][c].removeAsEnd();
      }
    }
    this.boxes[END_NODE[0]][END_NODE[1]].setAsEnd();
    this.onStartEndSet();
  }

  clearGrid() {
    for (let r = 0; r < this.graph.rowCount; r++) {
      for (let c = 0; c < this.graph.columnCount; c++) {
        this.setClear(r, c);
      }
    }
    START_NODE = null;
    END_NODE = null;
    this.onStartEnd();
  }

  paintGrid() {
    const sideLength = this.boxSize || this.getBoxSideLength();

    for (let r = 0; r < this.graph.rowCount; r++) {
      for (let c = 0; c < this.graph.columnCount; c++) {
        const node = this.graph.nodes[r][c];
        const x1 = sideLength * c;
        const y1 = sideLength * r;
        const x2 = x1 + sideLength;
        const y2 = y1 + sideLength;

        node.setPoints(new Point(x1, y1), new Point(x2, y2));
        node.draw();
        this.addEvents(node, r, c);
      }
    }
  }

  visualize(runnerCode) {
    this.__runner = new BfsRunner(
      this.getBox(...START_NODE),
      this.getBox(...END_NODE)
    );
    this.__runner.init();
    this.__runner.onStop = this.onRunnerStop;
    this.__runner.onStart = this.onRunnerStart;
  }

  getBox(r, c) {
    return this.boxes[r][c];
  }

  get boxes() {
    return this.graph.nodes;
  }

  get boxArea() {
    return this.boxes[0][0].path.area;
  }
  get runner() {
    return this.__runner;
  }
}

// Runners
class Runner {
  constructor() {
    this.timer = null;
    this.finish = null;
    this.onStop = () => {};
    this.onStart = () => {};
    this.onFrame = () => {};
  }

  recall() {
    this.onFrame();
    this.perFrame();
    if (this.finish) return;
    this.timer = setTimeout(() => this.recall(), 16);
  }

  init() {
    this.onStart();
    this.firstFrame();
    this.timer = setTimeout(() => this.recall(), 16);
  }

  stop() {
    clearTimeout(this.timer);
    this.onStop();
  }

  firstFrame() {
    throw new Error("need to be implemented");
  }
  perFrame() {
    throw new Error("need to be implemented");
  }
}

// Depth First Search
class DfsRunner extends Runner {
  constructor(startNode, endNode) {
    super();
    this.stack = null;
    this.set = null;
    this.startNode = startNode;
    this.endNode = endNode;
  }

  firstFrame() {
    this.stack = [];
    this.set = new Set();
    this.stack.push(this.startNode);
    this.finish = false;
  }

  perFrame() {
    if (this.stack.length > 0) {
      const node = this.stack.pop();
      if (node.id == this.endNode.id) {
        this.finish = true;
        this.stop();
        return;
      }
      if (!this.set.has(node) && node) {
        this.set.add(node);

        node.id != this.startNode.id ? node.setAsTraversed() : null;
        this.stack.push(...node.adjacents.values());
      }
    } else {
      this.finish = true;
      this.stop();
      return;
    }
  }
}

// Breadth First Search
class BfsRunner extends Runner {
  constructor(startNode, endNode) {
    super();
    this.queue = null;
    this.set = null;
    this.startNode = startNode;
    this.endNode = endNode;
  }

  firstFrame() {
    this.queue = [];
    this.set = new Set();
    this.queue.push(this.startNode);
    this.finish = false;
  }

  perFrame() {
    if (this.queue.length > 0) {
      const node = this.queue.shift();

      if (node.id == this.endNode.id) {
        this.finish = true;
        this.stop();
        return;
      }

      node.id != this.startNode.id ? node.setAsTraversed() : null;
      if (!this.set.has(node)) {
        this.set.add(node);
        this.queue.push(...node.adjacents.values());
      }
    } else {
      this.finish = true;
      this.stop();
      return;
    }
  }
}

function processGrid(rowCount, columnCount, width, height, boxSize) {
  project.clear();
  const graph = new GraphMatrix(rowCount, columnCount, Box);
  graph.process();
  ActiveGrid = new Grid(width, height, graph, boxSize);
  ActiveGrid.paintGrid();

  ActiveGrid.onStartEndSet = function() {
    if (START_NODE != null && END_NODE != null) {
      states.actionPanel.removeClass("invisible");
    } else {
      states.actionPanel.addClass("invisible");
    }
  };

  ActiveGrid.onRunnerStop = function() {
    states.actionPanel.addClass("invisible");
    states.startStopBtn.text("Start").prop("disabled", false);
    states.toolModeInput.prop("disabled", false);
  };

  ActiveGrid.onRunnerStart = function() {
    states.toolModeInput.prop("disabled", true);
  };
}

// settings
class StateHandler {
  constructor() {
    this.__activeMode = TOOL_MODE.WALL_NODES;
    this.__rowCount = null;
    this.__columnCount = null;
    this.__boxSize = null;
    this.__width = null;
    this.__height = null;
  }

  get activeMode() {
    return this.__activeMode;
  }

  get rowCount() {
    return this.__rowCount;
  }

  get columnCount() {
    return this.__columnCount;
  }

  get boxSize() {
    return this.__boxSize;
  }

  get height() {
    return this.__height;
  }
  get width() {
    return this.__width;
  }

  setState(state) {
    this.__activeMode = state.get("activeMode") || this.__activeMode;
    this.__rowCount = state.get("rowCount") || this.__rowCount;
    this.__columnCount = state.get("columnCount") || this.__columnCount;
    this.__activeMode = state.get("activeMode") || this.__activeMode;
    this.__height = state.get("height") || this.__height;
    this.__width = state.get("width") || this.__width;
  }
}

const settings = new StateHandler();

var init = () => {
  let boxSize = DEFAULT_BOX_SIZE;
  let columnCount = Math.trunc(states.width / boxSize);
  let rowCount = Math.trunc(states.height / boxSize);

  states.rowCountInput.val(rowCount);
  states.columnCountInput.val(columnCount);
  states.boxSizeInput.val(boxSize);

  states.rowCountInput.change(function(event) {
    rowCount = parseInt($(this).val()) || Math.trunc(states.height / t);
    processGrid(rowCount, columnCount, states.width, states.height, boxSize);
  });
  states.columnCountInput.change(function(event) {
    columnCount = parseInt($(this).val()) || Math.trunc(states.width / t);
    processGrid(rowCount, columnCount, states.width, states.height, boxSize);
  });
  states.boxSizeInput.change(function(event) {
    boxSize = parseInt($(this).val());
    processGrid(rowCount, columnCount, states.width, states.height, boxSize);
  });
  states.toolModeInput.change(function(event) {
    ACTION_TOOL_MODE = parseInt(this.value);
  });
  states.clearGraphBtn.click(function(event) {
    ActiveGrid.clearGrid();
    states.startStopBtn.text("Start").prop("disabled", false);
    if (timer != null) {
      clearTimeout(timer);
      timer = null;
    }
  });
  states.startStopBtn.click(function(event) {
    ActiveGrid.resetTraversal();
    ActiveGrid.visualize("Algo");
    $(this)
      .text("Running..")
      .prop("disabled", true);
  });

  processGrid(rowCount, columnCount, states.width, states.height, boxSize);
};

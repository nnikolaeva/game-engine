/* Engine class provides the game loop functionality (update entities and render),
 * draws the initial game board on the screen, and then calls the update and
 * render methods on your player and enemy objects (defined in your app.js).
 *
 * A game engine works by drawing the entire game screen over and over, kind of
 * like a flipbook you may have created as a kid. When your player moves across
 * the screen, it may look like just that image/character is moving or being
 * drawn but that is not the case. What's really happening is the entire "scene"
 * is being drawn over and over, presenting the illusion of animation.
 * Engine class translates game coordinates to pixels.
 */
var Engine = function(gridW, gridH, cols, rols) {
    var gridWidth = gridW;
    var gridHeight = gridH;
    var canvasWidth = gridW * cols;
    var canvasHeight = gridH * rols;
    this.lastTime;
    var canvas = document.getElementById("canvas");
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    var ctx = canvas.getContext("2d");
    this.on = true;

    this.eventsState = {
        pressedDraggable: false,
        wasMoving: false,
        state: "INIT",
        currentDragEntity: null,
        lastMouseEvent: null
    };

    this.dragStateData = {
        draggedEntityData: null
    };

    this.screen = {
        entities: [],
        subscribtions: [],
        userInputSubscribtions: [],
        timeSubscribtions: [],
        mouseEventSubscribtions: []
    };
    this.backupScreen = {
        entities: [],
        subscribtions: [],
        userInputSubscribtions: [],
        timeSubscribtions: [],
        mouseEventSubscribtions: []
    };

    var rect = canvas.getBoundingClientRect();

    this.handleMouseEvent = function(eventName, event) {
        if (this.isDrag(event)) {
            this.onDrag(event);
        } else {
            this.onMouseEvent(event);
        }

    };

    this.onMouseEvent = function(event) {
        if (event.type === "mousedown") {
            var e = this.getEntity(event);
            if (e.isDraggable) {
                this.eventsState.pressedDraggable = true;
            }
        } else if (event.type === "mouseup") {
            this.eventsState.pressedDraggable = false;
        }
        this.dispatchEvent(event);
    };

    this.onDrag = function(event) {
        switch (this.eventsState.state) {
            case "INIT":
                if (this.eventsState.pressedDraggable && event.type === "mousemove") {
                    this.eventsState.wasMoving = true;
                    this.eventsState.currentDragEntity = this.getEntity(event);
                    this.eventsState.state = "DRAGSTART";
                    this.onDrag(event);
                }
                break;
            case "DRAGSTART":
                this.sendDragStartEvent(event, this.eventsState.currentDragEntity);
                this.eventsState.state = "DRAGIN";
                this.onDrag(event);
                break;
            case "DRAGIN":
                this.eventsState.currentDragEntity = this.getEntity(event);
                this.sendDragInEvent(event, this.eventsState.currentDragEntity);
                this.eventsState.state = "DRAGOVER";
                this.onDrag(event);
                break;
            case "DRAGOVER":
                this.eventsState.lastMouseEvent = event;
                if (this.eventsState.currentDragEntity === this.getEntity(event)) {
                    if (event.type === "mouseup") {
                        this.eventsState.state = "DRAGEND";
                        this.onDrag(event);
                    } else {
                        this.sendDragOverEvent(event, this.eventsState.currentDragEntity);
                    }
                } else {
                    this.eventsState.state = "DRAGOUT";
                    this.onDrag(event);
                }
                break;
            case "DRAGOUT":
                this.sendDragOutEvent(event, this.eventsState.currentDragEntity);
                this.eventsState.state = "DRAGIN";
                this.onDrag(event);
                break;
            case "DRAGEND":
                this.sendDragEndEvent(event, this.eventsState.currentDragEntity);
                this.eventsState.state = "INIT";
                this.cleanUpEventsState();
                break;
        }

    };

    this.sendDragStartEvent = function(event, entity) {
        this.invokeSubscribtionCallback("dragstart", event, entity);
    };

    this.sendDragInEvent = function(event, entity) {
        this.invokeSubscribtionCallback("dragin", event, entity);
    };

    this.sendDragOverEvent = function(event, entity) {
        this.invokeSubscribtionCallback("dragover", event, entity);
    };

    this.sendDragOutEvent = function(event, entity) {
        this.invokeSubscribtionCallback("dragout", event, entity);
    };

    this.sendDragEndEvent = function(event, entity) {
        this.invokeSubscribtionCallback("dragend", event, entity);
    };

    this.invokeSubscribtionCallback = function(eventName, event, entity) {
        var sub = this.findSubscribtion(eventName, entity);
        var xy = this.translateToCanvasXY(event.clientX, event.clientY);
        if (sub !== null) {
            sub.callback(xy.x - entity.x, xy.y - entity.y, this.dragStateData);
        }
    };

    this.findSubscribtion = function(eventName, entity) {
        var sub;
        for (var i = 0; i < this.screen.mouseEventSubscribtions.length; i++) {
            sub = this.screen.mouseEventSubscribtions[i];
            if (sub.eventName === eventName && sub.entity === entity) {
                return sub;
            }
        }
        return null;
    };
    // Returns true if moving or releasing draggable entity.
    this.isDrag = function(e) {
        return (this.eventsState.pressedDraggable && (e.type === "mousemove" || (this.eventsState.wasMoving && e.type === "mouseup")));
    };

    this.cleanUpEventsState = function() {
        this.eventsState.pressedDraggable = false;
        this.eventsState.wasMoving = false;
        this.eventsState.lastMouseEvent = null;
    };

    this.translateToCanvasXY = function(clientX, clientY) {
        return {
            x: Math.floor((clientX - rect.left) / gridWidth),
            y: Math.floor((clientY - rect.top) / gridWidth)
        };
    };

    this.getEntity = function(event) {
        var x = Math.floor((event.clientX - rect.left) / gridWidth);
        var y = Math.floor((event.clientY - rect.top) / gridHeight);
        var prevEntity = this.getEntityXY(x, y);
        if (prevEntity === null) {
            return null;
        }
        while (true) {
            x = x - prevEntity.x;
            y = y - prevEntity.y;
            var e = prevEntity.getChildEntity(x, y);
            if (e === null) {
                return prevEntity;
            } else {
                prevEntity = e;
            }
        }
    };

    this.getEntityXY = function(x, y) {
        var entity;
        for (var j in this.screen.entities) {
            entity = this.screen.entities[j];
            if (x >= entity.x && x < entity.x + entity.w && y >= entity.y && y < entity.y + entity.h) {
                return entity;
            }
        }
        return null;
    };

    this.dispatchEvent = function(event) {
        var eventName = event.type;
        //  translate pixels to game coordinates
        var x = Math.floor((event.clientX - rect.left) / gridWidth);
        var y = Math.floor((event.clientY - rect.top) / gridHeight);
        var entity;
        var sub;
        for (var j in this.screen.entities) {
            entity = this.screen.entities[j];
            if (x >= entity.x && x < entity.x + entity.w && y >= entity.y && y < entity.y + entity.h) {
                for (var i = 0; i < this.screen.mouseEventSubscribtions.length; i++) {
                    sub = this.screen.mouseEventSubscribtions[i];
                    if (sub.eventName === eventName && sub.entity === entity) {
                        sub.callback(x - entity.x, y - entity.y);
                    }
                }
            }
        }
    };



    this.addEntityToScreen = function(entity) {
        this.screen.entities.push(entity);
    };
    this.addSubscribtion = function(subscribtion) {
        this.screen.subscribtions.push(subscribtion);
    };
    this.addUserInputSubscribtion = function(userInputSubscribtion) {
        this.screen.userInputSubscribtions.push(userInputSubscribtion);
    };
    this.addTimeSubscribtion = function(timeSubscribtion) {
        this.screen.timeSubscribtions.push(timeSubscribtion);
    };
    this.addMouseEventSubscribtion = function(mouseEventSubscribtion) {
        this.screen.mouseEventSubscribtions.push(mouseEventSubscribtion);
    };

    this.emptyScreen = function() {
        this.screen.entities.length = 0;
        this.screen.subscribtions.length = 0;
        this.screen.userInputSubscribtions.length = 0;
        this.screen.timeSubscribtions.length = 0;
        this.screen.mouseEventSubscribtions.length = 0;
    };

    this.emptyBackupScreen = function() {
        this.backupScreen.entities.length = 0;
        this.backupScreen.subscribtions.length = 0;
        this.backupScreen.userInputSubscribtions.length = 0;
        this.backupScreen.timeSubscribtions.length = 0;
        this.backupScreen.mouseEventSubscribtions.length = 0;
    };

    this.copyCurrentGameState = function() {
        copyScreen(this.screen, this.backupScreen);

    };
    // copy all elements from array1 to array2
    function copyArray(array1, array2) {
        for (var i in array1) {
            array2.push(array1[i]);
        }
    }
    // copy all elements from scr1 to scr2
    function copyScreen(scr1, scr2) {
        for (var key in scr1) {
            copyArray(scr1[key], scr2[key]);
        }
    }
    this.pasteCurrentGameState = function() {
        copyScreen(this.backupScreen, this.screen);
        this.emptyBackupScreen();
    };

    this.handleUserInput = function(keyCode, numRows, numCols) {
        var sub;
        var length = this.screen.userInputSubscribtions.length;
        for (var i = 0; i < length; i++) {
            sub = this.screen.userInputSubscribtions[i];
            for (var j in this.screen.entities) {
                if (this.screen.entities[j] === sub.entity && keyCode === sub.keyCode) {
                    sub.callback(this.screen.entities[j]);
                }
            }
        }
    };

    this.checkTimer = function() {
        var sub;
        for (var i in this.screen.timeSubscribtions) {
            sub = this.screen.timeSubscribtions[i];
            if (sub.entity.seconds < sub.number) {
                sub.callback();
            }
        }
    };

    this.clearGameBoard = function() {
        ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    };

    this.start = function() {
        var now = Date.now();
        var dt = (now - this.lastTime) / 1000.0;
        if (this.on) {
            this.update(dt);
        }
        this.render();
        this.checkCollision();
        this.checkTimer(dt);
        this.lastTime = now;
        requestAnimationFrame(this.start.bind(this));
    };

    this.update = function(dt) {
        var length = this.screen.entities.length;
        for (var i = 0; i < length; i++) {
            this.screen.entities[i].update(dt);
        }
    };

    this.render = function() {
        var length = this.screen.entities.length;
        for (var i = 0; i < length; i++) {
            this.screen.entities[i].render(this);
        }
        if (this.eventsState.lastMouseEvent !== null) {
            this.renderDragIcon(this.eventsState.lastMouseEvent);
        }
    };

    this.renderDragIcon = function(event) {
        var xy = this.translateToCanvasXY(event.clientX, event.clientY);
        var coords = [
            [0, -0.5],
            [-0.5, 0],
            [-0.5, 1],
            [0.5, 1],
            [0.5, -0.5],
            [0, -0.5]
        ];
        var first = true;
        var dx = 0.5;
        var dy = 0.5;
        var x;
        var y;
        ctx.beginPath();
        for (var i in coords) {
            x = (xy.x + coords[i][0] * 3 + dx) * gridWidth;
            y = (xy.y + coords[i][1] * 3 + dy) * gridHeight;
            if (!first) {
                ctx.lineTo(x, y);
            } else {
                ctx.moveTo(x, y);
            }
            first = false;
        }
        ctx.closePath();
        ctx.strokeStyle = "rgba(0, 0, 0, 0.3)";
        ctx.stroke();
        ctx.fillStyle = "rgba(0, 0, 255, 0.3)";
        ctx.fill();
    };

    this.drawImage = function(sprite, x, y) {
        ctx.drawImage(Resources.get(sprite.image), x * gridWidth + sprite.dx, y * gridHeight + sprite.dy);
    };
    this.drawRect = function(x, y, w, h, color) {
        ctx.fillStyle = color;
        ctx.fillRect(x * gridWidth, y * gridHeight, w * gridWidth, h * gridHeight);
    };
    this.drawFullScreenRect = function(color) {
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    };
    this.drawText = function(x, y, text, color, font) {
        ctx.fillStyle = color;
        ctx.font = font;
        ctx.fillText(text, x * gridWidth, y * gridHeight);
    };
    this.drawLine = function(x, y, x1, y1, width, color) {
        ctx.beginPath();
        ctx.moveTo(x * gridWidth, y * gridHeight);
        ctx.lineTo(x1 * gridWidth, y1 * gridHeight);
        ctx.lineWidth = width;
        ctx.strokeStyle = color;
        ctx.stroke();
    };
    this.drawCircle = function(x, y, radius, color) {
        ctx.beginPath();
        ctx.arc(x * gridWidth, y * gridHeight, radius, 0, 2 * Math.PI);
        ctx.fillStyle = color;
        ctx.fill();

    };

    var imageData = ctx.getImageData(0, 0, cols * gridWidth, rols * gridHeight);

    this.drawNewPixelsScaled = function(cells, dx, dy, sx, sy) {
        var width = cells.length * gridWidth * sx;
        var height = cells[0].length * gridHeight * sy;
        this.drawPixelsScaled(
            cells, dx, dy, sx, sy,
            ctx.createImageData(Math.round(width), Math.round(height)),
            1);

    };
    this.drawPixels = function(cells, dx, dy) {
        this.drawPixelsScaled(cells, dx, dy, 1, 1, imageData);
    };

    this.drawPixelsScaled = function(cells, dx, dy, sx, sy, imageData) {
        var data = imageData.data;
        var cell;
        var offset = 0;
        var px;
        var py;
        var width = cells.length;
        var height = cells[0].length;
        for (var x = 0; x < width; x++) {
            for (var y = 0; y < height; y++) {
                cell = cells[x][y];
                for (var x1 = 0; x1 < gridWidth; x1++) {
                    for (var y1 = 0; y1 < gridHeight; y1++) {
                        px = x * gridWidth + x1;
                        py = y * gridHeight + y1;
                        px = Math.floor(px * sx);
                        py = Math.floor(py * sy);
                        offset = (px + py * imageData.width) * 4;
                        data[offset + 0] = cell.color;
                        data[offset + 1] = cell.color;
                        data[offset + 2] = cell.color;
                        data[offset + 3] = 255;
                    }
                }
            }
        }
        ctx.putImageData(imageData, dx * gridWidth, dy * gridHeight);
    };

    this.checkCollision = function() {
        var s;
        var e;
        var t;
        var c;
        var cX;
        var cwidth;
        var eX;
        var ewidth;
        for (var item in this.screen.subscribtions) {
            s = this.screen.subscribtions[item];
            e = s.entity;
            t = s.types;
            var candidates = [];
            var element;
            for (var i in t) {
                for (var k = 0; k < this.screen.entities.length; k++) {
                    element = this.screen.entities[k];
                    if (element instanceof t[i]) {
                        candidates.push(element);
                    }
                    for (l in element.components) {
                        if (element.components[l] instanceof t[i]) {
                            candidates.push(element.components[l]);
                        }
                    }
                }
            }
            eX = e.x + e.sprite.bbox.x;
            ewidth = e.sprite.bbox.w;
            for (var k in candidates) {
                c = candidates[k];
                cX = c.x + c.sprite.bbox.x;
                cwidth = c.sprite.bbox.w;
                if (((c.y === e.y) && (cX + cwidth >= eX && cX + cwidth <= eX + ewidth)) || ((c.y === e.y) && (eX + ewidth >= cX && eX + ewidth <= cX + cwidth))) {
                    s.callback(c);
                }
            }
        }
    };
};

var Subscribtion = function(entity, types, callback) {
    this.entity = entity;
    this.types = types;
    this.callback = callback;
};

var UserInputSubscribtion = function(keyCode, entity, callback) {
    this.keyCode = keyCode;
    this.entity = entity;
    this.callback = callback;
};

var TimeSubscribtion = function(entity, number, callback) {
    this.entity = entity;
    this.number = number;
    this.callback = callback;
};

var MouseEventSubscribtion = function(eventName, entity, callback) {
    this.eventName = eventName;
    this.entity = entity;
    this.callback = callback;
};
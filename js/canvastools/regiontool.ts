/// <reference types="snapsvg" />
import * as CT from "./basetool.js";
import * as Snap from "./../../snapsvg/snap.svg.js";
import base = CT.CanvasTools.Base;

export namespace CanvasTools.Region { 
    interface onManipulationFunction {
        (UIElement?: base.IRegionPart): void;
    }

    interface onChangeFunction {
        (x: number, y: number, width:number, height:number): void;
    }


    /*
     * AnchorsElement 
     * Used internally to draw anchors to resize the region
    */
    class AnchorsElement implements base.IRegionPart {
        // Region size
        public rect: base.IRect;

        // Region position
        public x: number;
        public y: number;

        // Bound rects
        private boundRect: base.IRect;

        // Ancors composition
        public anchorsGroup:Snap.Element;
        private anchors: {TL: Snap.Element, TR: Snap.Element, BR:Snap.Element, BL: Snap.Element};
        private ghostAnchor: Snap.Element;

        // Change Notifier
        private onChange: Function;

        // Manipulation notifiers
        public onManipulationBegin: onManipulationFunction;
        public onManipulationEnd: onManipulationFunction;

        constructor(paper:Snap.Paper, x: number, y: number, rect:base.IRect, boundRect:base.IRect = null, onChange?: onChangeFunction, onManipulationBegin?: onManipulationFunction, onManipulationEnd?:onManipulationFunction) {
            this.x = x;
            this.y = y;
            this.rect = rect;
            this.boundRect = boundRect;

            if (onChange !== undefined) {
                this.onChange = onChange;
            }

            if (onManipulationBegin !== undefined) {
                this.onManipulationBegin = onManipulationBegin;
            }
            if (onManipulationEnd !== undefined) {
                this.onManipulationEnd = onManipulationEnd;
            }

            this.buildOn(paper);
            this.subscribeToEvents();
        }

        private buildOn(paper:Snap.Paper){
            this.anchorsGroup = paper.g();
            this.anchorsGroup.addClass("ancorsLayer");
            this.anchors = {
                TL: this.createAnchor(paper, "TL"),
                TR: this.createAnchor(paper, "TR"),
                BL: this.createAnchor(paper, "BL"),
                BR: this.createAnchor(paper, "BR")
            };
            this.ghostAnchor = this.createAnchor(paper, "ghost", 7);

            this.rearrangeAnchors();   
            
            this.anchorsGroup.add(this.anchors.TL);
            this.anchorsGroup.add(this.anchors.TR);
            this.anchorsGroup.add(this.anchors.BR);
            this.anchorsGroup.add(this.anchors.BL);
            this.anchorsGroup.add(this.ghostAnchor);
        }

        private createAnchor(paper: Snap.Paper, style: string = "", r:number = 3): Snap.Element {
            let a = paper.circle(0, 0, r);            
            a.addClass("anchorStyle");
            a.addClass(style);
            return a;
        }

        public move(p: base.IPoint2D) {
            this.x = p.x;
            this.y = p.y;
            this.rearrangeAnchors();
        }

        public resize(width: number, height: number) {
            this.rect.width = width;
            this.rect.height = height;
            this.rearrangeAnchors();
        }

        private rearrangeAnchors() {
            this.anchors.TL.attr({ cx: this.x, cy: this.y });
            this.anchors.TR.attr({ cx: this.x + this.rect.width, cy: this.y});
            this.anchors.BR.attr({ cx: this.x + this.rect.width, cy: this.y + this.rect.height});
            this.anchors.BL.attr({ cx: this.x, cy: this.y + this.rect.height});
        }

        private rearrangeCoord(p1: base.IPoint2D, p2: base.IPoint2D, flipX: boolean, flipY: boolean) {
            let x = (p1.x < p2.x) ? p1.x : p2.x;
            let y = (p1.y < p2.y) ? p1.y : p2.y;
            let width = Math.abs(p1.x - p2.x);
            let height = Math.abs(p1.y - p2.y);

            this.flipActiveAnchor(flipX, flipY);
            
            this.onChange(x, y, width, height, true);
        }

        private activeAnchor: string;
        private originalAnchor: string;
        private flipActiveAnchor(flipX:boolean, flipY:boolean) {
            let ac:string = "";
            if (this.activeAnchor !== "") {
                ac += (this.activeAnchor[0] == "T") ? (flipY? "B": "T") : (flipY? "T" : "B");
                ac += (this.activeAnchor[1] == "L") ? (flipX? "R": "L") : (flipX? "L" : "R");
            }

            if (this.activeAnchor != ac) {
                this.ghostAnchor.removeClass(this.activeAnchor);
                this.activeAnchor = ac;
                this.ghostAnchor.addClass(this.activeAnchor);
            }

            if (flipX) {
                if (this.activeAnchor[1] == "R") {
                    this.pointOrigin.x += this.rectOrigin.width;
                }                
                this.rectOrigin.width = 0;
            } 

            if (flipY) {
                if (this.activeAnchor[0] == "B") {
                    this.pointOrigin.y += this.rectOrigin.height;
                }
                this.rectOrigin.height = 0;
            }
         }
        
        private dragOrigin: base.Point2D;
        private pointOrigin: base.Point2D;
        private rectOrigin: base.IRect;

        private anchorDragBegin() {
            this.originalAnchor = this.activeAnchor;
        }

        private getDragOriginPoint() {
            let x: number, y: number;
            
            switch (this.activeAnchor) {
                case "TL": {
                    x = this.x;
                    y = this.y;
                    break;
                }
                case "TR": {
                    x = this.x + this.rect.width;
                    y = this.y;
                    break;
                }
                case "BL": {
                    x = this.x;
                    y = this.y + this.rect.height;
                    break;
                }
                case "BR": {
                    x = this.x + this.rect.width;
                    y = this.y + this.rect.height;
                    break;
                }
            }
            return new base.Point2D(x, y);
        }
        
        private anchorDragMove(dx:number, dy:number, x: number, y: number) {
            // Calculation depends on active ancor!!
            let p1: base.Point2D, p2: base.Point2D;
            let x1: number, y1: number, x2: number, y2: number;
            let flipX:boolean = false;
            let flipY:boolean = false;

            x1 = this.dragOrigin.x + dx;
            y1 = this.dragOrigin.y + dy;

            switch (this.activeAnchor) {
                case "TL": {
                    x2 = this.pointOrigin.x + this.rectOrigin.width;
                    y2 = this.pointOrigin.y + this.rectOrigin.height;
                    flipX = x2 < x1;
                    flipY = y2 < y1;
                    break;
                }
                case "TR": {
                    x2 = this.pointOrigin.x;
                    y2 = this.pointOrigin.y + this.rectOrigin.height;
                    flipX = x1 < x2;
                    flipY = y2 < y1;
                    break;
                }
                case "BL": {
                    y2 = this.pointOrigin.y;
                    x2 = this.pointOrigin.x + this.rectOrigin.width;
                    flipX = x2 < x1;
                    flipY = y1 < y2;
                    break;
                }
                case "BR": {
                    x2 = this.pointOrigin.x;
                    y2 = this.pointOrigin.y;
                    flipX = x1 < x2;
                    flipY = y1 < y2;
                    break;
                }
            }

            p1 = new base.Point2D(x1, y1);
            p2 = new base.Point2D(x2, y2);

            if (this.boundRect !== null) {
                p1 = p1.boundToRect(this.boundRect);
                p2 = p2.boundToRect(this.boundRect);
            }

            window.requestAnimationFrame(() => {
                this.ghostAnchor.attr({ cx: x1, cy: y1 });
            });

            this.rearrangeCoord(p1, p2, flipX, flipY);
        };

        private anchorDragEnd() {
            //this.dragOrigin = null;
            this.ghostAnchor.attr({
                display: "none"
            })
        }

        private subscribeToEvents() {
            let self = this;
            this.subscribeAnchorToEvents(this.anchors.TL, "TL");
            this.subscribeAnchorToEvents(this.anchors.TR, "TR");
            this.subscribeAnchorToEvents(this.anchors.BL, "BL");
            this.subscribeAnchorToEvents(this.anchors.BR, "BR");

            self.ghostAnchor.mouseover(function(e){
                self.ghostAnchor.drag(
                    self.anchorDragMove.bind(self),
                    self.anchorDragBegin.bind(self),
                    self.anchorDragEnd.bind(self)
                );                
                self.ghostAnchor.addClass(self.activeAnchor);
                self.onManipulationBegin();
            });

            self.ghostAnchor.mouseout(function(e){
                self.ghostAnchor.undrag();
                window.requestAnimationFrame(function(){
                    self.ghostAnchor.attr({
                        display: "none"
                    })
                });

                self.ghostAnchor.removeClass(self.activeAnchor);
                self.onManipulationEnd();
            });

            self.ghostAnchor.node.addEventListener("pointerdown", function(e){
                self.ghostAnchor.node.setPointerCapture(e.pointerId);
            });

            self.ghostAnchor.node.addEventListener("pointerup", function(e){
                self.ghostAnchor.node.releasePointerCapture(e.pointerId);
            });
        }

        private subscribeAnchorToEvents(ancor:Snap.Element, active:string) {
            ancor.mouseover((e) => {
                this.activeAnchor = active;
                // Set drag origin point to current ancor
                let p = this.getDragOriginPoint();    
                this.dragOrigin = p;
                this.rectOrigin = this.rect.copy();
                this.pointOrigin = new base.Point2D(this.x, this.y);
                // Move ghost ancor to current ancor position
                window.requestAnimationFrame(() => {
                    this.ghostAnchor.attr({ 
                        cx: p.x, 
                        cy: p.y,
                        display: 'block' });
                });                
                
            });
        }

        // IHideable -> hide()
        public hide() {
            let self = this;
            window.requestAnimationFrame(function(){
                self.anchorsGroup.attr({
                    visibility: 'hidden'
                });
            }) 
        }
        
        // IHideable -> show()
        public show() {
            let self = this;
            window.requestAnimationFrame(function(){
                self.anchorsGroup.attr({
                    visibility: 'visible'
                });
            }) 
        }
    }

    /*
     * TagsElement 
     * Used internally to draw labels and map colors for the region
    */
    class TagsElement  implements base.IRegionPart {
        // Region size
        public rect: base.IRect;

        // Region position
        public x: number;
        public y: number;

        // Elements
        public tagsGroup:Snap.Element;
        private primaryTagRect: Snap.Element;
        private primaryTagText: Snap.Element;
        private primaryTagTextBG: Snap.Element;

        // Tags
        public tags: base.TagsDescriptor;

        // Styling
        private styleId: string;
        private styleSheet: CSSStyleSheet = null;

        constructor(paper:Snap.Paper, x: number, y: number, rect:base.IRect, tags: base.TagsDescriptor, styleId: string, styleSheet: CSSStyleSheet){
            this.tags = tags;
            this.rect = rect;
            this.x = x;
            this.y = y;


            this.styleId = styleId;
            this.styleSheet = styleSheet;

            this.buildOn(paper);
        }

        private buildOn(paper:Snap.Paper){
            this.tagsGroup = paper.g();
            this.tagsGroup.addClass("tagsLayer");    
            
            this.primaryTagRect = paper.rect(0, 0, this.rect.width, this.rect.height);
            this.primaryTagRect.addClass("primaryTagRectStyle");

            this.primaryTagText = paper.text(0, 0, this.tags.primary.name);
            this.primaryTagText.addClass("primaryTagTextStyle");

            let box = this.primaryTagText.getBBox();
            // bound to region???
            this.primaryTagTextBG = paper.rect(0, 0, box.width + 10, box.height + 5);
            this.primaryTagTextBG.addClass("primaryTagTextBGStyle");
            
            this.tagsGroup.add(this.primaryTagRect);
            this.tagsGroup.add(this.primaryTagTextBG);
            this.tagsGroup.add(this.primaryTagText);            
            this.applyColors();
        }

        // Map colors to region
        public applyColors() {
            // Map primary tag color
            if (this.tags && this.tags.primary !== undefined) {
                let styleMap = [
                    {
                        rule: `.${this.styleId} .primaryTagRectStyle`,
                        style: `fill: ${this.tags.primary.colorShadow};
                                stroke:${this.tags.primary.colorAccent};`
                    },
                    {
                        rule: `.regionStyle.${this.styleId}:hover  .primaryTagRectStyle`,
                        style: `fill: ${this.tags.primary.colorHighlight}; 
                                stroke: #fff;`
                    },
                    {
                        rule: `.regionStyle.selected.${this.styleId} .primaryTagRectStyle`,
                        style: `fill: ${this.tags.primary.colorHighlight};
                                stroke:${this.tags.primary.colorAccent};`
                    },
                    {
                        rule: `.regionStyle.${this.styleId} .ancorStyle`,
                        style: `stroke:${this.tags.primary.colorHighlight};
                                fill:${this.tags.primary.colorPure};`
                    },
                    {
                        rule: `.regionStyle.${this.styleId}:hover .ancorStyle`,
                        style: `stroke:#fff;`
                    },
                    {
                        rule: `.regionStyle.${this.styleId} .ancorStyle.ghost`,
                        style: `fill:transparent;`
                    },
                    {
                        rule: `.regionStyle.${this.styleId} .ancorStyle.ghost:hover`,
                        style: `fill:${this.tags.primary.colorPure};`
                    },
                    {
                        rule: `.regionStyle.${this.styleId} .primaryTagTextBGStyle`,
                        style: `fill:${this.tags.primary.colorAccent};`
                    },
                ];

                for (var i = 0; i < styleMap.length; i++) {
                    let r = styleMap[i];
                    this.styleSheet.insertRule(`${r.rule}{${r.style}}`);
                }
            }            
        }

        public move(p: base.IPoint2D) {           
            this.x = p.x;
            this.y = p.y;
            this.primaryTagRect.attr({
                x: p.x,
                y: p.y
            });
            this.primaryTagText.attr({
                x: p.x + 5,
                y: p.y + this.primaryTagText.getBBox().height
            });
            this.primaryTagTextBG.attr({
                x: p.x + 1,
                y: p.y + 1
            })  
        }

        public resize(width: number, height: number){
            this.rect.width = width;
            this.rect.height = height;

            this.primaryTagRect.attr({
                width: width,
                height: height
            });
        }

        // IHideable -> hide()
        public hide() {
            let self = this;
            window.requestAnimationFrame(function(){
                self.tagsGroup.attr({
                    visibility: 'hidden'
                });
            }) 
        }

        // IHideable -> show()
        public show() {
            let self = this;
            window.requestAnimationFrame(function(){
                self.tagsGroup.attr({
                    visibility: 'visible'
                });
            }) 
        }
    } 

    /*
     * DragElement 
     * Used internally to drag the region
    */
    class DragElement implements base.IRegionPart {
        // Region size
        public rect: base.IRect;

        // Region position
        public x: number;
        public y: number;

        // Drag rect
        public dragGroup: Snap.Element;
        private dragRect: Snap.Element;

        // Bounding box
        private boundRect: base.IRect;

        // Change Notifier
        private onChange: Function;

        // Manipulation notifiers
        public onManipulationBegin: onManipulationFunction;
        public onManipulationEnd: onManipulationFunction;

        constructor(paper:Snap.Paper, x: number, y: number, rect:base.IRect, boundRect:base.IRect = null, onChange?: onChangeFunction, onManipulationBegin?: onManipulationFunction, onManipulationEnd?:onManipulationFunction){
            this.rect = rect;
            this.x = x;
            this.y = y;

            this.boundRect = boundRect;
            
            if (onChange !== undefined) {
                this.onChange = onChange;
            }

            if (onManipulationBegin !== undefined) {
                this.onManipulationBegin = onManipulationBegin;
            }
            if (onManipulationEnd !== undefined) {
                this.onManipulationEnd = onManipulationEnd;
            }

            this.buildOn(paper);
            this.subscribeToEvents();
        }

        private buildOn(paper:Snap.Paper){
            this.dragGroup = paper.g();
            this.dragGroup.addClass("dragLayer");    
            
            this.dragRect = paper.rect(0, 0, this.rect.width, this.rect.height);
            this.dragRect.addClass("dragRectStyle");

            this.dragGroup.add(this.dragRect);
        }

        public move(p: base.IPoint2D) {           
            this.x = p.x;
            this.y = p.y;
            this.dragRect.attr({
                x: p.x,
                y: p.y
            });  
        }

        public resize(width: number, height: number){
            this.rect.width = width;
            this.rect.height = height;

            this.dragRect.attr({
                width: width,
                height: height
            });
        }

        // IHideable -> hide()
        public hide() {
            let self = this;
            window.requestAnimationFrame(function(){
                self.dragRect.attr({
                    visibility: 'hidden'
                });
            }) 
        }

        // IHideable -> show()
        public show() {
            let self = this;
            window.requestAnimationFrame(function(){
                self.dragRect.attr({
                    visibility: 'visible'
                });
            }) 
        }

        private dragOrigin: base.Point2D;

        private rectDragBegin() {
            this.dragOrigin = new base.Point2D(this.x, this.y);
        }
        
        private rectDragMove(dx:number, dy:number) {
            let p:base.IPoint2D;
            p = new base.Point2D(this.dragOrigin.x + dx, this.dragOrigin.y + dy);

            if (this.boundRect !== null) {                
                p = p.boundToRect(this.boundRect);
            }
            //this.move(p);
            this.onChange(p.x, p.y, this.rect.width, this.rect.height);
        };

        private rectDragEnd() {
            this.dragOrigin = null;
        }

        private subscribeToEvents() {
            let self = this;

            self.dragRect.mouseover(function(e){
                self.dragRect.drag(self.rectDragMove.bind(self), self.rectDragBegin.bind(self), self.rectDragEnd.bind(self));
                self.onManipulationBegin();
            })

            self.dragRect.mouseout(function(e){
                self.dragRect.undrag();
                self.onManipulationEnd();
            });

            self.dragRect.node.addEventListener("pointerdown", function(e){
                self.dragRect.node.setPointerCapture(e.pointerId);                
            });

            self.dragRect.node.addEventListener("pointerup", function(e){
                self.dragRect.node.releasePointerCapture(e.pointerId);
            });

            self.dragRect.click(function(e){
                self.onChange(self.x, self.y, self.rect.width, self.rect.height, true);
            });
        }
    }

    /*
     * MenuElement 
     * Used internally to show actions menu for the region
    */
   class MenuElement implements base.IRegionPart {
    // Region size
    public rect: base.IRect;

    // Region position
    public x: number;
    public y: number;

    // Menu Item Size
    private menuItemSize:number = 20;
    // Menu position;
    private mx: number;
    private my: number;
    private mw: number = this.menuItemSize + 10;
    private mh: number = 60;
    
    // threshold for positioning menu inside/outside
    private dh: number = 20;
    // threshold for positioning menu left/right
    private dw: number = 5;

    // Menu group
    public menuGroup: Snap.Paper;
    public menuRect: Snap.Element;
    public menuItemsGroup: Snap.Element;
    public menuItems: Array<Snap.Element>;

    // Bounding box
    private boundRect: base.IRect;

    // Manipulation notifiers
    public onManipulationBegin: onManipulationFunction;
    public onManipulationEnd: onManipulationFunction;

    // Snap Paper
    private paper: Snap.Paper;

    private region: RegionElement;

    constructor(paper:Snap.Paper, x: number, y: number, rect:base.IRect, boundRect:base.IRect = null, onManipulationBegin?: onManipulationFunction, onManipulationEnd?:onManipulationFunction){
        this.paper = paper;
        this.rect = rect;
        this.x = x;
        this.y = y;

        this.boundRect = boundRect;
        
        if (onManipulationBegin !== undefined) {
            this.onManipulationBegin = onManipulationBegin;
        }
        if (onManipulationEnd !== undefined) {
            this.onManipulationEnd = onManipulationEnd;
        }

        this.buildOn(this.paper);
    }

    private buildOn(paper:Snap.Paper){
        let menuSVG = this.paper.svg(this.mx, this.my, this.mw, this.mh, this.mx, this.my, this.mw, this.mh) as SVGGraphicsElement;

        // Snap.Paper
        this.menuGroup = Snap(menuSVG).paper;
        this.menuGroup.addClass("menuLayer");
                
        this.rearrangeMenuPosition();

        this.menuRect = this.menuGroup.rect(0, 0, this.mw, this.mh, 5, 5);
        this.menuRect.addClass("menuRectStyle");

        this.menuItemsGroup = this.menuGroup.g();
        this.menuItemsGroup.addClass("menuItems");

        this.menuItems = new Array<Snap.Element>();

        this.menuGroup.add(this.menuRect);
        this.menuGroup.add(this.menuItemsGroup);
        //this.menuGroup.add(this.menuRect);
        //this.menuGroup.add(this.menuItemsGroup);

        this.menuGroup.mouseover((e) => {
            this.onManipulationBegin();
        })
        this.menuGroup.mouseout((e) => {
            this.onManipulationEnd();
        })
    }

    private pathCollection = {
        "delete": {
            path: "M 83.4 21.1 L 74.9 12.6 L 48 39.5 L 21.1 12.6 L 12.6 21.1 L 39.5 48 L 12.6 74.9 L 21.1 83.4 L 48 56.5 L 74.9 83.4 L 83.4 74.9 L 56.5 48 Z",
            iconSize: 96
        }
    }

    public addAction(action: string, icon:string, actor: Function) {
        let item = this.menuGroup.g();
        let itemBack = this.menuGroup.rect(5, 5, this.menuItemSize, this.menuItemSize, 5, 5);
        itemBack.addClass("menuItemBack");

        let k = (this.menuItemSize - 4) / this.pathCollection.delete.iconSize;
        let itemIcon = this.menuGroup.path(this.pathCollection.delete.path);
        itemIcon.transform(`scale(0.2) translate(26 26)`);

        //let itemIcon = this.menuGroup.text(6, 19, "✖");
        itemIcon.addClass("menuIcon");
        itemIcon.addClass("menuIcon-" + icon);

        let itemRect = this.menuGroup.rect(5, 5, this.menuItemSize, this.menuItemSize, 5, 5);
        itemRect.addClass("menuItem");

        item.add(itemBack);
        item.add(itemIcon);
        item.add(itemRect);

        item.click((e) => {
            actor(this.region);
        });

        this.menuItemsGroup.add(item);
        this.menuItems.push(item);
    }

    private rearrangeMenuPosition() {
        // position menu inside
        if (this.mh <= this.rect.height - this.dh) {
            this.my = this.y + this.rect.height / 2 - this.mh / 2;
            // position menu on the right side
            if (this.x + this.rect.width + this.mw/2 + this.dw < this.boundRect.width) {
                this.mx = this.x + this.rect.width - this.mw/2;
            } 
            // position menu on the left side
            else if (this.x - this.mw/2 - this.dw > 0) {
                this.mx = this.x - this.mw/2;
            }
            // position menu on the right side INSIDE 
            else {
                this.mx = this.x + this.rect.width - this.mw - this.dw;
            }
        } 
        // position menu outside
        else {
            this.my = this.y;
            // position menu on the right side
            if (this.x + this.rect.width + this.mw + 2 * this.dw < this.boundRect.width) {
                this.mx = this.x + this.rect.width + this.dw;
            } 
            // position menu on the left side
            else if (this.x - this.mw - 2 * this.dw > 0) {
                this.mx = this.x - this.mw - this.dw;
            }
            // position menu on the right side INSIDE 
            else {
                this.mx = this.x + this.rect.width - this.mw - this.dw;
            }
        }
    }

    public attachTo(region: RegionElement) {
        this.region = region;
        this.x = region.x;
        this.y = region.y;
        this.rect = region.rect;
        this.rearrangeMenuPosition();

        let self = this;
        window.requestAnimationFrame(function(){
            self.menuGroup.attr({
                x: self.mx,
                y: self.my
            });
        })  
    }

    public move(p: base.IPoint2D) {           
        let self = this;
        this.x = p.x;
        this.y = p.y;

        this.rearrangeMenuPosition();

        window.requestAnimationFrame(function(){
            self.menuGroup.attr({
                x: self.mx,
                y: self.my
            });
        })  
    }

    public resize(width: number, height: number){
        let self = this;
        this.rect.width = width;
        this.rect.height = height;

        this.rearrangeMenuPosition();

        window.requestAnimationFrame(function(){
            self.menuGroup.attr({
                x: self.mx,
                y: self.my
            });
        }) 
    }

    // IHideable -> hide()
    public hide() {
        let self = this;
        window.requestAnimationFrame(function(){
            self.menuGroup.attr({
                visibility: 'hidden'
            });
        }) 
    }

    // IHideable -> show()
    public show() {
        let self = this;
        window.requestAnimationFrame(function(){
            self.menuGroup.attr({
                visibility: 'visible'
            });
        }) 
    }    
}

    class RegionElement implements base.IHideable, base.IResizable{
        // Region size
        public rect: base.IRect;

        // Region position
        public x: number;
        public y: number;

        // Bound rects
        private boundRects: {host: base.IRect, self: base.IRect };

        // Region components
        public regionGroup: Snap.Element;
        private drag: DragElement;
        private anchors: AnchorsElement;
        private tags: TagsElement;
        private UI: Array<base.IRegionPart>;

        // Region data
        private tagsDescriptor: base.TagsDescriptor;

        // Region state        
        private isSelected:boolean = false;

        // Region styles
        public regionID: string
        private styleID: string;
        private styleSheet: CSSStyleSheet = null;

        // Manipulation notifiers
        public onManipulationBegin: onManipulationFunction;
        public onManipulationEnd: onManipulationFunction;

        constructor(paper: Snap.Paper, rect:base.IRect, boundRect:base.IRect = null, tagsDescriptor: base.TagsDescriptor, onManipulationBegin?: onManipulationFunction, onManipulationEnd?:onManipulationFunction){
            this.x = 0;
            this.y = 0;
            this.rect = rect;
            this.tagsDescriptor = tagsDescriptor;

            if (boundRect !== null) {
                this.boundRects = { 
                    host: boundRect, 
                    self: new base.Rect(boundRect.width - rect.width, boundRect.height - rect.height)
                };
            }

            if (onManipulationBegin !== undefined) {
                this.onManipulationBegin = () => {
                    onManipulationBegin(this);
                }
            }
            if (onManipulationEnd !== undefined) {
                this.onManipulationEnd = () => {
                    onManipulationEnd(this);
                };
            }

            this.regionID = this.s8();
            this.styleID = `region_${ this.regionID }_style`;
            this.styleSheet = this.insertStyleSheet();
        
            this.buildOn(paper);
        }

        private buildOn(paper: Snap.Paper){
            this.regionGroup = paper.g();
            this.regionGroup.addClass("regionStyle");
            this.regionGroup.addClass(this.styleID);

            this.anchors = new AnchorsElement(paper, this.x, this.y, this.rect,this.boundRects.host, this.onInternalChange.bind(this), this.onManipulationBegin, this.onManipulationEnd);
            this.drag = new DragElement(paper, this.x, this.y, this.rect, this.boundRects.self, this.onInternalChange.bind(this), this.onManipulationBegin, this.onManipulationEnd);
            this.tags = new TagsElement(paper, this.x, this.y, this.rect, this.tagsDescriptor, this.styleID, this.styleSheet);
            
            this.regionGroup.add(this.tags.tagsGroup);
            this.regionGroup.add(this.drag.dragGroup);                      
            this.regionGroup.add(this.anchors.anchorsGroup);  
            
            this.UI = new Array<base.IRegionPart>(this.tags, this.drag, this.anchors);
        }

        // Helper function to generate random id;
        private s8() {
            return Math.floor((1 + Math.random()) * 0x100000000)
              .toString(16)
              .substring(1);
        }

        // Helper function to insert a new stylesheet into the document
        private insertStyleSheet(): CSSStyleSheet {
            var style = document.createElement("style");
            style.setAttribute("id", this.styleID);
            document.head.appendChild(style);
            return style.sheet as CSSStyleSheet;
        }

        public clearStyles() {
            // clear style all rules for region
            if (this.styleSheet != null) {
                for (var i=0; i<this.styleSheet.cssRules.length; i++) {
                    this.styleSheet.deleteRule (i);
                }  
            }
        }

        public removeStyles() {
            document.getElementById(this.styleID).remove();
        }

        private onInternalChange(x: number, y:number, width: number, height:number, clicked: boolean = false) {
            this.move(new base.Point2D(x, y));
            this.resize(width, height);

/*             if (clicked) {
                if (this.isSelected) {
                    this.unselect();                    
                } else {
                    this.select();                    
                }
            } */

            this.onChange(this, clicked);
        }

        public move(p: base.IPoint2D) {           
            let self = this;
            this.x = p.x;
            this.y = p.y;
            window.requestAnimationFrame(function(){
                self.UI.forEach((element) => {
                    element.move(p);
                });
            })  
        }

        public resize(width: number, height: number){
            this.rect.width = width;
            this.rect.height = height;

            this.boundRects.self.width = this.boundRects.host.width - width;
            this.boundRects.self.height = this.boundRects.host.height - height;

            let self = this;
            window.requestAnimationFrame(function(){
                self.UI.forEach((element) => {
                    element.resize(width, height);
                });
            }) 
        }

        // IHideable -> hide()
        public hide() {
            let self = this;
            window.requestAnimationFrame(function(){
                self.regionGroup.attr({
                    visibility: 'hidden'
                });
            }) 
        }

        // IHideable -> show()
        public show() {
            let self = this;
            window.requestAnimationFrame(function(){
                self.regionGroup.attr({
                    visibility: 'visible'
                });
            }) 
        }

        public onChange: Function;

        public select() {
            this.isSelected = true;
            this.regionGroup.addClass("selected");

/*             if (this.onChange != undefined) {
                this.onChange(this, this.isSelected);
            } */
        }

        public unselect() {
            this.isSelected = false;
            this.regionGroup.removeClass("selected");

/*             if (this.onChange != undefined) {
                this.onChange(this, this.isSelected);
            } */
        }
    }

    export class RegionsManager {
        private baseParent:SVGSVGElement;
        private paper: Snap.Paper;
        private paperRect: base.Rect;

        private regions: Array<RegionElement>;    
        
        private menuLayer: Snap.Element;
        private menu: MenuElement;

        public onManipulationBegin: onManipulationFunction;
        public onManipulationEnd: onManipulationFunction;

        private regionManagerLayer:Snap.Element;

        constructor(svgHost: SVGSVGElement, onManipulationBegin: onManipulationFunction, onManipulationEnd: onManipulationFunction){
            this.baseParent = svgHost;
            this.paper = Snap(svgHost);
            this.paperRect = new base.Rect(svgHost.width.baseVal.value, svgHost.height.baseVal.value);

            this.regionManagerLayer = this.paper.g();
            this.regionManagerLayer.addClass("regionManager");

            this.onManipulationBegin = onManipulationBegin;
            this.onManipulationEnd = onManipulationEnd;

            this.regions = new Array<RegionElement>();

            this.menuLayer = this.paper.g();
            this.menuLayer.addClass("menuManager");
            this.menu = new MenuElement(this.paper, 0, 0, new base.Rect(0,0), this.paperRect, 
                                        this.onManipulationBegin_local.bind(this), 
                                         this.onManipulationEnd_local.bind(this));

            this.menu.addAction("delete", "trash", (region: RegionElement) => {
                console.log(region.regionID);
                this.deleteRegion(region);
                this.menu.hide();
            })
            this.menuLayer.add(this.menu.menuGroup);
            this.menu.hide();
        }

        public addRegion(pointA: base.IPoint2D, pointB: base.IPoint2D, tagsDescriptor: base.TagsDescriptor) {
            this.menu.hide();

            let x = (pointA.x < pointB.x) ? pointA.x : pointB.x;
            let y = (pointA.y < pointB.y) ? pointA.y : pointB.y;
            let w = Math.abs(pointA.x - pointB.x);
            let h = Math.abs(pointA.y - pointB.y);

            let region = new RegionElement(this.paper, new base.Rect(w, h), this.paperRect, tagsDescriptor, 
                this.onManipulationBegin_local.bind(this), 
                this.onManipulationEnd_local.bind(this));
            region.move(new base.Point2D(x, y));

            region.onChange = this.onRegionUpdate.bind(this);

            this.unselectRegions();
            region.select();

            this.regionManagerLayer.add(region.regionGroup);
            this.regions.push(region);

            this.menu.attachTo(region);
            this.menu.show();
        }

        public deleteRegion(region:RegionElement){
            // remove style
            region.removeStyles();
            
            // remove element
            region.regionGroup.remove();
        }

        public resize(width: number, height: number){
            let tw = width / this.paperRect.width;
            let th = height / this.paperRect.height;

            this.paperRect.resize(width, height);
            
            // recalculate size/position for all regions;
            for (var i = 0; i < this.regions.length; i++){
                let r = this.regions[i];
                r.move(new base.Point2D(r.x * tw, r.y * th));
                r.resize(r.rect.width * tw, r.rect.height * th);
            }            
        }

        private onManipulationBegin_local(region: RegionElement) {
            this.onManipulationBegin();
        }
        private onManipulationEnd_local(region: RegionElement) {
            this.onManipulationEnd();
        }

        public onRegionUpdate(region: RegionElement, clicked: boolean) {
            if (clicked) {
                this.menu.hide();
                this.unselectRegions(region);
                region.select();                    
                this.menu.attachTo(region);
                this.menu.show();
            } else {
                this.menu.hide();
                region.unselect();
            }
        }

        public unselectRegions(except?: RegionElement){
            for (var i = 0; i < this.regions.length; i++){
                let r = this.regions[i];
                if (r != except) {
                    r.unselect();
                }
            } 
        }
    }
}
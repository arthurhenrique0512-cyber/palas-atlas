import Cocoa

// MARK: - Configurações Globais
class OverlayConfig {
    static let shared = OverlayConfig()
    
    var isLocked: Bool = false {
        didSet {
            NotificationCenter.default.post(name: .overlayConfigChanged, object: nil)
        }
    }
    
    var isVisible: Bool = true {
        didSet {
            NotificationCenter.default.post(name: .overlayConfigChanged, object: nil)
        }
    }
    
    var lineColor: NSColor = .systemYellow {
        didSet {
            NotificationCenter.default.post(name: .overlayConfigChanged, object: nil)
        }
    }
    
    var colorName: String = "Amarelo Neon"
    
    var lineWidth: CGFloat = 3.0 {
        didSet {
            NotificationCenter.default.post(name: .overlayConfigChanged, object: nil)
        }
    }
    
    var lineAlpha: CGFloat = 0.95 {
        didSet {
            NotificationCenter.default.post(name: .overlayConfigChanged, object: nil)
        }
    }
    
    var isDashed: Bool = false {
        didSet {
            NotificationCenter.default.post(name: .overlayConfigChanged, object: nil)
        }
    }
    
    var showCenterCross: Bool = true {
        didSet {
            NotificationCenter.default.post(name: .overlayConfigChanged, object: nil)
        }
    }
    
    var showRuleOfThirds: Bool = false {
        didSet {
            NotificationCenter.default.post(name: .overlayConfigChanged, object: nil)
        }
    }
    
    var showLabels: Bool = true {
        didSet {
            NotificationCenter.default.post(name: .overlayConfigChanged, object: nil)
        }
    }
}

extension Notification.Name {
    static let overlayConfigChanged = Notification.Name("OverlayConfigChanged")
}

// MARK: - Modos de Arraste e Redimensionamento
enum DragMode {
    case none
    case move
    case resizeTopLeft
    case resizeTopRight
    case resizeBottomLeft
    case resizeBottomRight
    case resizeLeft
    case resizeRight
    case resizeTop
    case resizeBottom
}

// MARK: - View das Linhas de Marcação e Redimensionamento Interativo
class GuideOverlayView: NSView {
    
    private var toolbarStack: NSStackView!
    private var lockButton: NSButton!
    private var shrinkButton: NSButton!
    private var growButton: NSButton!
    private var aspect4by3Button: NSButton!
    private var aspect16by9Button: NSButton!
    private var fullScreenButton: NSButton!
    
    private var initialMouseScreenLoc: NSPoint = .zero
    private var initialWindowFrame: NSRect = .zero
    private var currentDragMode: DragMode = .none
    
    override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        wantsLayer = true
        setupToolbar()
        NotificationCenter.default.addObserver(self, selector: #selector(configChanged), name: .overlayConfigChanged, object: nil)
    }
    
    required init?(coder: NSCoder) {
        super.init(coder: coder)
        wantsLayer = true
        setupToolbar()
        NotificationCenter.default.addObserver(self, selector: #selector(configChanged), name: .overlayConfigChanged, object: nil)
    }
    
    deinit {
        NotificationCenter.default.removeObserver(self)
    }
    
    private func setupToolbar() {
        toolbarStack = NSStackView()
        toolbarStack.orientation = .horizontal
        toolbarStack.spacing = 6
        toolbarStack.alignment = .centerY
        toolbarStack.wantsLayer = true
        toolbarStack.layer?.backgroundColor = NSColor.black.withAlphaComponent(0.85).cgColor
        toolbarStack.layer?.cornerRadius = 8
        toolbarStack.layer?.borderColor = NSColor.white.withAlphaComponent(0.25).cgColor
        toolbarStack.layer?.borderWidth = 1.0
        toolbarStack.edgeInsets = NSEdgeInsets(top: 4, left: 8, bottom: 4, right: 8)
        
        func createButton(title: String, action: Selector, bg: NSColor? = nil, fg: NSColor = .white) -> NSButton {
            let btn = NSButton(title: title, target: self, action: action)
            btn.bezelStyle = .rounded
            btn.font = NSFont.systemFont(ofSize: 11, weight: .semibold)
            btn.wantsLayer = true
            if let bg = bg {
                btn.contentTintColor = .black
                btn.layer?.backgroundColor = bg.cgColor
                btn.layer?.cornerRadius = 5
            } else {
                btn.contentTintColor = fg
            }
            return btn
        }
        
        shrinkButton = createButton(title: "➖ Menor", action: #selector(shrinkSize))
        growButton = createButton(title: "➕ Maior", action: #selector(growSize))
        aspect4by3Button = createButton(title: "4:3", action: #selector(setAspect4by3))
        aspect16by9Button = createButton(title: "16:9", action: #selector(setAspect16by9))
        fullScreenButton = createButton(title: "⛶ Tela Cheia", action: #selector(setFullScreen))
        lockButton = createButton(title: "🔒 Travar", action: #selector(lockAction), bg: .systemYellow)
        
        toolbarStack.addArrangedSubview(shrinkButton)
        toolbarStack.addArrangedSubview(growButton)
        toolbarStack.addArrangedSubview(aspect4by3Button)
        toolbarStack.addArrangedSubview(aspect16by9Button)
        toolbarStack.addArrangedSubview(fullScreenButton)
        toolbarStack.addArrangedSubview(lockButton)
        
        addSubview(toolbarStack)
        updateControlsLayout()
    }
    
    @objc private func lockAction() {
        OverlayConfig.shared.isLocked = true
    }
    
    @objc private func shrinkSize() {
        resizeByScale(0.9)
    }
    
    @objc private func growSize() {
        resizeByScale(1.1)
    }
    
    private func resizeByScale(_ scale: CGFloat) {
        guard let win = window else { return }
        let current = win.frame
        let newW = max(200, current.width * scale)
        let newH = max(160, current.height * scale)
        let newFrame = NSRect(
            x: current.midX - newW / 2.0,
            y: current.midY - newH / 2.0,
            width: newW,
            height: newH
        )
        win.setFrame(newFrame, display: true, animate: true)
    }
    
    @objc private func setAspect4by3() {
        guard let win = window else { return }
        let current = win.frame
        let newH = current.width * (3.0 / 4.0)
        let newFrame = NSRect(x: current.origin.x, y: current.midY - newH / 2.0, width: current.width, height: newH)
        win.setFrame(newFrame, display: true, animate: true)
    }
    
    @objc private func setAspect16by9() {
        guard let win = window else { return }
        let current = win.frame
        let newH = current.width * (9.0 / 16.0)
        let newFrame = NSRect(x: current.origin.x, y: current.midY - newH / 2.0, width: current.width, height: newH)
        win.setFrame(newFrame, display: true, animate: true)
    }
    
    @objc private func setFullScreen() {
        guard let win = window, let screen = win.screen ?? NSScreen.main else { return }
        win.setFrame(screen.frame, display: true, animate: true)
    }
    
    @objc func configChanged() {
        updateControlsLayout()
        window?.invalidateCursorRects(for: self)
        needsDisplay = true
    }
    
    override func resizeSubviews(withOldSize oldSize: NSSize) {
        super.resizeSubviews(withOldSize: oldSize)
        updateControlsLayout()
        window?.invalidateCursorRects(for: self)
    }
    
    private func updateControlsLayout() {
        let isLocked = OverlayConfig.shared.isLocked
        toolbarStack.isHidden = isLocked
        
        let stackSize = toolbarStack.fittingSize
        let topY = bounds.height - stackSize.height - 10
        let midX = bounds.width / 2.0
        toolbarStack.frame = NSRect(x: midX - stackSize.width / 2.0, y: max(0, topY), width: stackSize.width, height: stackSize.height)
    }
    
    // MARK: - Redimensionamento Interativo via Mouse Drag
    override func mouseDown(with event: NSEvent) {
        guard !OverlayConfig.shared.isLocked else {
            super.mouseDown(with: event)
            return
        }
        
        let loc = convert(event.locationInWindow, from: nil)
        initialMouseScreenLoc = NSEvent.mouseLocation
        initialWindowFrame = window?.frame ?? .zero
        
        let cornerSize: CGFloat = 36.0
        let edgeThickness: CGFloat = 14.0
        let w = bounds.width
        let h = bounds.height
        
        // 1. Cantos
        if loc.x <= cornerSize && loc.y <= cornerSize {
            currentDragMode = .resizeBottomLeft
        } else if loc.x >= w - cornerSize && loc.y <= cornerSize {
            currentDragMode = .resizeBottomRight
        } else if loc.x <= cornerSize && loc.y >= h - cornerSize {
            currentDragMode = .resizeTopLeft
        } else if loc.x >= w - cornerSize && loc.y >= h - cornerSize {
            currentDragMode = .resizeTopRight
        // 2. Bordas
        } else if loc.x <= edgeThickness {
            currentDragMode = .resizeLeft
        } else if loc.x >= w - edgeThickness {
            currentDragMode = .resizeRight
        } else if loc.y <= edgeThickness {
            currentDragMode = .resizeBottom
        } else if loc.y >= h - edgeThickness {
            currentDragMode = .resizeTop
        // 3. Área interna: Mover janela
        } else {
            currentDragMode = .move
        }
    }
    
    override func mouseDragged(with event: NSEvent) {
        guard !OverlayConfig.shared.isLocked, let win = window, currentDragMode != .none else {
            super.mouseDragged(with: event)
            return
        }
        
        let currentMouse = NSEvent.mouseLocation
        let dx = currentMouse.x - initialMouseScreenLoc.x
        let dy = currentMouse.y - initialMouseScreenLoc.y
        
        var newFrame = initialWindowFrame
        let minW: CGFloat = 200
        let minH: CGFloat = 160
        
        switch currentDragMode {
        case .move:
            newFrame.origin.x = initialWindowFrame.origin.x + dx
            newFrame.origin.y = initialWindowFrame.origin.y + dy
            
        case .resizeBottomRight:
            let proposedW = max(minW, initialWindowFrame.width + dx)
            let proposedH = max(minH, initialWindowFrame.height - dy)
            newFrame.origin.x = initialWindowFrame.minX
            newFrame.origin.y = initialWindowFrame.maxY - proposedH
            newFrame.size.width = proposedW
            newFrame.size.height = proposedH
            
        case .resizeBottomLeft:
            let proposedW = max(minW, initialWindowFrame.width - dx)
            let proposedH = max(minH, initialWindowFrame.height - dy)
            newFrame.origin.x = initialWindowFrame.maxX - proposedW
            newFrame.origin.y = initialWindowFrame.maxY - proposedH
            newFrame.size.width = proposedW
            newFrame.size.height = proposedH
            
        case .resizeTopRight:
            let proposedW = max(minW, initialWindowFrame.width + dx)
            let proposedH = max(minH, initialWindowFrame.height + dy)
            newFrame.origin.x = initialWindowFrame.minX
            newFrame.origin.y = initialWindowFrame.minY
            newFrame.size.width = proposedW
            newFrame.size.height = proposedH
            
        case .resizeTopLeft:
            let proposedW = max(minW, initialWindowFrame.width - dx)
            let proposedH = max(minH, initialWindowFrame.height + dy)
            newFrame.origin.x = initialWindowFrame.maxX - proposedW
            newFrame.origin.y = initialWindowFrame.minY
            newFrame.size.width = proposedW
            newFrame.size.height = proposedH
            
        case .resizeRight:
            newFrame.size.width = max(minW, initialWindowFrame.width + dx)
            
        case .resizeLeft:
            let proposedW = max(minW, initialWindowFrame.width - dx)
            newFrame.origin.x = initialWindowFrame.maxX - proposedW
            newFrame.size.width = proposedW
            
        case .resizeTop:
            newFrame.size.height = max(minH, initialWindowFrame.height + dy)
            
        case .resizeBottom:
            let proposedH = max(minH, initialWindowFrame.height - dy)
            newFrame.origin.y = initialWindowFrame.maxY - proposedH
            newFrame.size.height = proposedH
            
        case .none:
            break
        }
        
        win.setFrame(newFrame, display: true)
    }
    
    override func mouseUp(with event: NSEvent) {
        currentDragMode = .none
        super.mouseUp(with: event)
    }
    
    // Configura os cursores de redimensionamento ao passar o mouse pelas bordas/cantos
    override func resetCursorRects() {
        super.resetCursorRects()
        guard !OverlayConfig.shared.isLocked else { return }
        
        let cornerSize: CGFloat = 36.0
        let edgeThickness: CGFloat = 14.0
        let w = bounds.width
        let h = bounds.height
        
        // Cantos: cursor diagonal ou crosshair
        addCursorRect(NSRect(x: 0, y: 0, width: cornerSize, height: cornerSize), cursor: .crosshair)
        addCursorRect(NSRect(x: w - cornerSize, y: 0, width: cornerSize, height: cornerSize), cursor: .crosshair)
        addCursorRect(NSRect(x: 0, y: h - cornerSize, width: cornerSize, height: cornerSize), cursor: .crosshair)
        addCursorRect(NSRect(x: w - cornerSize, y: h - cornerSize, width: cornerSize, height: cornerSize), cursor: .crosshair)
        
        // Bordas
        addCursorRect(NSRect(x: 0, y: cornerSize, width: edgeThickness, height: h - cornerSize * 2), cursor: .resizeLeftRight)
        addCursorRect(NSRect(x: w - edgeThickness, y: cornerSize, width: edgeThickness, height: h - cornerSize * 2), cursor: .resizeLeftRight)
        addCursorRect(NSRect(x: cornerSize, y: 0, width: w - cornerSize * 2, height: edgeThickness), cursor: .resizeUpDown)
        addCursorRect(NSRect(x: cornerSize, y: h - edgeThickness, width: w - cornerSize * 2, height: edgeThickness), cursor: .resizeUpDown)
        
        // Centro: cursor de mão aberta para mover
        let centerRect = bounds.insetBy(dx: cornerSize, dy: cornerSize)
        addCursorRect(centerRect, cursor: .openHand)
    }
    
    // MARK: - Desenho do Frame e Guias
    override func draw(_ dirtyRect: NSRect) {
        super.draw(dirtyRect)
        
        let config = OverlayConfig.shared
        guard config.isVisible else { return }
        
        let w = bounds.width
        let h = bounds.height
        guard w > 30 && h > 30 else { return }
        
        let leftX = w * 0.15
        let rightX = w * 0.85
        let bottomY = h * 0.15
        let topY = h * 0.85
        
        let activeColor = config.lineColor.withAlphaComponent(config.lineAlpha)
        let shadowColor = NSColor.black.withAlphaComponent(0.85)
        
        // 1. Moldura e Alças Visuais de Redimensionamento (quando destravado)
        if !config.isLocked {
            drawInteractiveResizeHandles(width: w, height: h)
        }
        
        // 2. Regra dos Terços (opcional)
        if config.showRuleOfThirds {
            let thirdsColor = activeColor.withAlphaComponent(config.lineAlpha * 0.4)
            for f in [1.0/3.0, 2.0/3.0] {
                let x = w * CGFloat(f)
                let y = h * CGFloat(f)
                drawLine(from: NSPoint(x: x, y: 0), to: NSPoint(x: x, y: h), color: thirdsColor, shadowColor: shadowColor.withAlphaComponent(0.3), width: 1.0, dashed: true)
                drawLine(from: NSPoint(x: 0, y: y), to: NSPoint(x: w, y: y), color: thirdsColor, shadowColor: shadowColor.withAlphaComponent(0.3), width: 1.0, dashed: true)
            }
        }
        
        // 3. Linhas Principais de 15% (Esquerda, Direita, Base, Topo)
        drawLine(from: NSPoint(x: leftX, y: 0), to: NSPoint(x: leftX, y: h), color: activeColor, shadowColor: shadowColor, width: config.lineWidth, dashed: config.isDashed)
        drawLine(from: NSPoint(x: rightX, y: 0), to: NSPoint(x: rightX, y: h), color: activeColor, shadowColor: shadowColor, width: config.lineWidth, dashed: config.isDashed)
        drawLine(from: NSPoint(x: 0, y: bottomY), to: NSPoint(x: w, y: bottomY), color: activeColor, shadowColor: shadowColor, width: config.lineWidth, dashed: config.isDashed)
        drawLine(from: NSPoint(x: 0, y: topY), to: NSPoint(x: w, y: topY), color: activeColor, shadowColor: shadowColor, width: config.lineWidth, dashed: config.isDashed)
        
        // 4. Cantos da Área Segura
        drawCornerBrackets(left: leftX, right: rightX, bottom: bottomY, top: topY, color: activeColor, shadowColor: shadowColor)
        
        // 5. Cruz Central (+)
        if config.showCenterCross {
            let cx = w / 2.0
            let cy = h / 2.0
            let crossSize: CGFloat = 20.0
            drawLine(from: NSPoint(x: cx - crossSize, y: cy), to: NSPoint(x: cx + crossSize, y: cy), color: activeColor, shadowColor: shadowColor, width: config.lineWidth, dashed: false)
            drawLine(from: NSPoint(x: cx, y: cy - crossSize), to: NSPoint(x: cx, y: cy + crossSize), color: activeColor, shadowColor: shadowColor, width: config.lineWidth, dashed: false)
            
            let dotRect = NSRect(x: cx - 3, y: cy - 3, width: 6, height: 6)
            let dotShadow = NSBezierPath(ovalIn: dotRect.insetBy(dx: -1.5, dy: -1.5))
            shadowColor.setFill()
            dotShadow.fill()
            
            let dot = NSBezierPath(ovalIn: dotRect)
            activeColor.setFill()
            dot.fill()
        }
        
        // 6. Rótulos "15%" nas linhas
        if config.showLabels {
            drawLabels(leftX: leftX, rightX: rightX, bottomY: bottomY, topY: topY, color: activeColor)
        }
    }
    
    private func drawLine(from p1: NSPoint, to p2: NSPoint, color: NSColor, shadowColor: NSColor, width: CGFloat, dashed: Bool) {
        let bgPath = NSBezierPath()
        bgPath.lineWidth = width + 2.5
        bgPath.move(to: p1)
        bgPath.line(to: p2)
        if dashed {
            bgPath.setLineDash([8, 6], count: 2, phase: 0)
        }
        shadowColor.setStroke()
        bgPath.stroke()
        
        let fgPath = NSBezierPath()
        fgPath.lineWidth = width
        fgPath.move(to: p1)
        fgPath.line(to: p2)
        if dashed {
            fgPath.setLineDash([8, 6], count: 2, phase: 0)
        }
        color.setStroke()
        fgPath.stroke()
    }
    
    private func drawCornerBrackets(left: CGFloat, right: CGFloat, bottom: CGFloat, top: CGFloat, color: NSColor, shadowColor: NSColor) {
        let arm: CGFloat = 18.0
        let corners: [(NSPoint, NSPoint, NSPoint)] = [
            (NSPoint(x: left, y: bottom + arm), NSPoint(x: left, y: bottom), NSPoint(x: left + arm, y: bottom)),
            (NSPoint(x: right - arm, y: bottom), NSPoint(x: right, y: bottom), NSPoint(x: right, y: bottom + arm)),
            (NSPoint(x: left, y: top - arm), NSPoint(x: left, y: top), NSPoint(x: left + arm, y: top)),
            (NSPoint(x: right - arm, y: top), NSPoint(x: right, y: top), NSPoint(x: right, y: top - arm))
        ]
        
        for (p1, corner, p2) in corners {
            let bgPath = NSBezierPath()
            bgPath.lineWidth = 5.0
            bgPath.move(to: p1)
            bgPath.line(to: corner)
            bgPath.line(to: p2)
            shadowColor.setStroke()
            bgPath.stroke()
            
            let fgPath = NSBezierPath()
            fgPath.lineWidth = 2.5
            fgPath.move(to: p1)
            fgPath.line(to: corner)
            fgPath.line(to: p2)
            color.setStroke()
            fgPath.stroke()
        }
    }
    
    private func drawLabels(leftX: CGFloat, rightX: CGFloat, bottomY: CGFloat, topY: CGFloat, color: NSColor) {
        let attrs: [NSAttributedString.Key: Any] = [
            .font: NSFont.boldSystemFont(ofSize: 12),
            .foregroundColor: color
        ]
        
        func drawBadge(text: String, at point: NSPoint) {
            let str = NSAttributedString(string: text, attributes: attrs)
            let size = str.size()
            let badgeRect = NSRect(x: point.x - 4, y: point.y - 2, width: size.width + 8, height: size.height + 4)
            let path = NSBezierPath(roundedRect: badgeRect, xRadius: 4, yRadius: 4)
            NSColor.black.withAlphaComponent(0.75).setFill()
            path.fill()
            str.draw(at: point)
        }
        
        drawBadge(text: "15% LATERAL", at: NSPoint(x: leftX + 8, y: topY - 24))
        drawBadge(text: "15% LATERAL", at: NSPoint(x: rightX - 110, y: topY - 24))
        drawBadge(text: "15% TOPO", at: NSPoint(x: leftX + 8, y: topY + 8))
        drawBadge(text: "15% BASE", at: NSPoint(x: leftX + 8, y: bottomY - 22))
    }
    
    private func drawInteractiveResizeHandles(width: CGFloat, height: CGFloat) {
        // Moldura ciano ao redor
        let borderPath = NSBezierPath(rect: bounds.insetBy(dx: 2, dy: 2))
        borderPath.lineWidth = 3.0
        let borderDash: [CGFloat] = [8, 5]
        borderPath.setLineDash(borderDash, count: 2, phase: 0)
        NSColor.systemCyan.withAlphaComponent(0.85).setStroke()
        borderPath.stroke()
        
        // Alças Visuais sólidas nos 4 cantos para indicar redimensionamento
        let hSize: CGFloat = 22.0
        let handleColor = NSColor.systemCyan
        
        func drawCornerGrip(at p: NSPoint, dx: CGFloat, dy: CGFloat) {
            let path = NSBezierPath()
            path.move(to: NSPoint(x: p.x, y: p.y + dy))
            path.line(to: p)
            path.line(to: NSPoint(x: p.x + dx, y: p.y))
            path.lineWidth = 4.0
            
            NSColor.black.withAlphaComponent(0.8).setStroke()
            path.stroke()
            
            handleColor.setStroke()
            path.lineWidth = 2.5
            path.stroke()
        }
        
        drawCornerGrip(at: NSPoint(x: 4, y: 4), dx: hSize, dy: hSize)
        drawCornerGrip(at: NSPoint(x: width - 4, y: 4), dx: -hSize, dy: hSize)
        drawCornerGrip(at: NSPoint(x: 4, y: height - 4), dx: hSize, dy: -hSize)
        drawCornerGrip(at: NSPoint(x: width - 4, y: height - 4), dx: -hSize, dy: -hSize)
        
        // Dica no canto inferior direito
        let tipAttrs: [NSAttributedString.Key: Any] = [
            .font: NSFont.systemFont(ofSize: 10, weight: .bold),
            .foregroundColor: NSColor.white
        ]
        let tipStr = NSAttributedString(string: "⤡ Arraste aqui para redimensionar", attributes: tipAttrs)
        let tipSize = tipStr.size()
        let tipRect = NSRect(x: width - tipSize.width - 24, y: 10, width: tipSize.width + 12, height: tipSize.height + 4)
        let pill = NSBezierPath(roundedRect: tipRect, xRadius: 4, yRadius: 4)
        NSColor.black.withAlphaComponent(0.8).setFill()
        pill.fill()
        tipStr.draw(at: NSPoint(x: tipRect.origin.x + 6, y: tipRect.origin.y + 2))
    }
}

// MARK: - Janela Flutuante Always-on-Top
class OverlayWindow: NSWindow {
    
    init() {
        let screenRect = NSScreen.main?.visibleFrame ?? NSRect(x: 0, y: 0, width: 1440, height: 900)
        let defaultWidth: CGFloat = min(900, screenRect.width * 0.70)
        let defaultHeight: CGFloat = min(620, screenRect.height * 0.70)
        let initialRect = NSRect(
            x: screenRect.midX - defaultWidth / 2,
            y: screenRect.midY - defaultHeight / 2,
            width: defaultWidth,
            height: defaultHeight
        )
        
        super.init(
            contentRect: initialRect,
            styleMask: [.borderless],
            backing: .buffered,
            defer: false
        )
        
        self.level = .statusBar
        self.hidesOnDeactivate = false
        self.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary, .stationary]
        self.isOpaque = false
        self.backgroundColor = .clear
        self.hasShadow = false
        self.minSize = NSSize(width: 200, height: 160)
        
        let overlayView = GuideOverlayView(frame: NSRect(origin: .zero, size: initialRect.size))
        overlayView.autoresizingMask = [.width, .height]
        self.contentView = overlayView
        
        NotificationCenter.default.addObserver(self, selector: #selector(configUpdated), name: .overlayConfigChanged, object: nil)
        updateMouseInteractivity()
    }
    
    deinit {
        NotificationCenter.default.removeObserver(self)
    }
    
    @objc func configUpdated() {
        updateMouseInteractivity()
    }
    
    func updateMouseInteractivity() {
        let config = OverlayConfig.shared
        self.ignoresMouseEvents = config.isLocked
        
        if config.isVisible {
            self.orderFrontRegardless()
        } else {
            self.orderOut(nil)
        }
    }
}

// MARK: - Menu Bar
class MenuBarController: NSObject, NSMenuDelegate {
    private var statusItem: NSStatusItem!
    private var overlayWindow: OverlayWindow!
    
    private var lockMenuItem: NSMenuItem!
    private var visibleMenuItem: NSMenuItem!
    private var dashedMenuItem: NSMenuItem!
    private var crossMenuItem: NSMenuItem!
    private var thirdsMenuItem: NSMenuItem!
    private var labelsMenuItem: NSMenuItem!
    
    init(overlayWindow: OverlayWindow) {
        self.overlayWindow = overlayWindow
        super.init()
        
        setupStatusItem()
        NotificationCenter.default.addObserver(self, selector: #selector(syncMenuItems), name: .overlayConfigChanged, object: nil)
    }
    
    private func setupStatusItem() {
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        
        if let button = statusItem.button {
            button.title = "📐 15%"
            button.toolTip = "CameraGuide 15% - Linhas de Enquadramento"
        }
        
        let menu = NSMenu()
        menu.delegate = self
        
        let titleItem = NSMenuItem(title: "CameraGuide 15% (Mac)", action: nil, keyEquivalent: "")
        titleItem.isEnabled = false
        menu.addItem(titleItem)
        menu.addItem(NSMenuItem.separator())
        
        lockMenuItem = NSMenuItem(title: "🔒 Travar (Permite Clicar na Câmera por Trás)", action: #selector(toggleLock), keyEquivalent: "l")
        lockMenuItem.target = self
        menu.addItem(lockMenuItem)
        
        visibleMenuItem = NSMenuItem(title: "👁️ Ocultar Linhas", action: #selector(toggleVisibility), keyEquivalent: "h")
        visibleMenuItem.target = self
        menu.addItem(visibleMenuItem)
        
        menu.addItem(NSMenuItem.separator())
        
        // Submenu Redimensionar / Presets
        let sizeMenu = NSMenu()
        sizeMenu.addItem(NSMenuItem(title: "➕ Ampliar (+10%)", action: #selector(growSize), keyEquivalent: "+"))
        sizeMenu.addItem(NSMenuItem(title: "➖ Reduzir (-10%)", action: #selector(shrinkSize), keyEquivalent: "-"))
        sizeMenu.addItem(NSMenuItem.separator())
        sizeMenu.addItem(NSMenuItem(title: "Proporção 4:3 (Padrão de Câmera)", action: #selector(preset4by3), keyEquivalent: "4"))
        sizeMenu.addItem(NSMenuItem(title: "Proporção 16:9 (Widescreen)", action: #selector(preset16by9), keyEquivalent: "9"))
        sizeMenu.addItem(NSMenuItem(title: "Proporção 1:1 (Quadrado)", action: #selector(preset1by1), keyEquivalent: "1"))
        sizeMenu.addItem(NSMenuItem(title: "Tela Cheia (Monitor Atual)", action: #selector(presetFullScreen), keyEquivalent: "f"))
        sizeMenu.addItem(NSMenuItem(title: "Centralizar na Tela", action: #selector(presetCenter), keyEquivalent: "c"))
        for it in sizeMenu.items { it.target = self }
        
        let sizeSubmenuItem = NSMenuItem(title: "📐 Redimensionar & Proporções", action: nil, keyEquivalent: "")
        sizeSubmenuItem.submenu = sizeMenu
        menu.addItem(sizeSubmenuItem)
        
        menu.addItem(NSMenuItem.separator())
        
        // Cores
        let colorMenu = NSMenu()
        let colors: [(name: String, color: NSColor)] = [
            ("Amarelo Neon (Padrão)", .systemYellow),
            ("Verde Neon", .systemGreen),
            ("Ciano", .systemCyan),
            ("Vermelho", .systemRed),
            ("Branco", .white),
            ("Laranja", .systemOrange),
            ("Magenta", .systemPink),
            ("Preto", .black)
        ]
        
        for (name, color) in colors {
            let item = NSMenuItem(title: name, action: #selector(changeColor(_:)), keyEquivalent: "")
            item.target = self
            item.representedObject = color
            colorMenu.addItem(item)
        }
        
        let colorSubmenuItem = NSMenuItem(title: "🎨 Cor da Linha", action: nil, keyEquivalent: "")
        colorSubmenuItem.submenu = colorMenu
        menu.addItem(colorSubmenuItem)
        
        // Espessura
        let widthMenu = NSMenu()
        for w in [1.0, 2.0, 3.0, 4.0, 5.0] {
            let item = NSMenuItem(title: "\(Int(w)) px", action: #selector(changeWidth(_:)), keyEquivalent: "")
            item.target = self
            item.representedObject = CGFloat(w)
            widthMenu.addItem(item)
        }
        let widthSubmenuItem = NSMenuItem(title: "📏 Espessura da Linha", action: nil, keyEquivalent: "")
        widthSubmenuItem.submenu = widthMenu
        menu.addItem(widthSubmenuItem)
        
        menu.addItem(NSMenuItem.separator())
        
        // Opções Visuais
        dashedMenuItem = NSMenuItem(title: "Linha Tracejada", action: #selector(toggleDashed), keyEquivalent: "")
        dashedMenuItem.target = self
        menu.addItem(dashedMenuItem)
        
        crossMenuItem = NSMenuItem(title: "Marca de Centro (+)", action: #selector(toggleCenterCross), keyEquivalent: "")
        crossMenuItem.target = self
        menu.addItem(crossMenuItem)
        
        thirdsMenuItem = NSMenuItem(title: "Grade Regra dos Terços (3x3)", action: #selector(toggleRuleOfThirds), keyEquivalent: "")
        thirdsMenuItem.target = self
        menu.addItem(thirdsMenuItem)
        
        labelsMenuItem = NSMenuItem(title: "Mostrar Rótulos \"15%\"", action: #selector(toggleLabels), keyEquivalent: "")
        labelsMenuItem.target = self
        menu.addItem(labelsMenuItem)
        
        menu.addItem(NSMenuItem.separator())
        
        let quitItem = NSMenuItem(title: "Sair do CameraGuide", action: #selector(quitApp), keyEquivalent: "q")
        quitItem.target = self
        menu.addItem(quitItem)
        
        statusItem.menu = menu
        syncMenuItems()
    }
    
    @objc func syncMenuItems() {
        let config = OverlayConfig.shared
        if config.isLocked {
            lockMenuItem.title = "🔓 Destravar Posição (Permite Mover/Redimensionar)"
            if let button = statusItem.button {
                button.title = "🔒 15%"
            }
        } else {
            lockMenuItem.title = "🔒 Travar (Permite Clicar na Câmera por Trás)"
            if let button = statusItem.button {
                button.title = "📐 15%"
            }
        }
        
        visibleMenuItem.title = config.isVisible ? "👁️ Ocultar Linhas" : "👁️ Mostrar Linhas"
        dashedMenuItem.state = config.isDashed ? .on : .off
        crossMenuItem.state = config.showCenterCross ? .on : .off
        thirdsMenuItem.state = config.showRuleOfThirds ? .on : .off
        labelsMenuItem.state = config.showLabels ? .on : .off
    }
    
    @objc func toggleLock() {
        OverlayConfig.shared.isLocked.toggle()
    }
    
    @objc func toggleVisibility() {
        OverlayConfig.shared.isVisible.toggle()
    }
    
    @objc func toggleDashed() {
        OverlayConfig.shared.isDashed.toggle()
    }
    
    @objc func toggleCenterCross() {
        OverlayConfig.shared.showCenterCross.toggle()
    }
    
    @objc func toggleRuleOfThirds() {
        OverlayConfig.shared.showRuleOfThirds.toggle()
    }
    
    @objc func toggleLabels() {
        OverlayConfig.shared.showLabels.toggle()
    }
    
    @objc func changeColor(_ sender: NSMenuItem) {
        if let color = sender.representedObject as? NSColor {
            OverlayConfig.shared.lineColor = color
            OverlayConfig.shared.colorName = sender.title
        }
    }
    
    @objc func changeWidth(_ sender: NSMenuItem) {
        if let w = sender.representedObject as? CGFloat {
            OverlayConfig.shared.lineWidth = w
        }
    }
    
    @objc func shrinkSize() {
        resizeByScale(0.9)
    }
    
    @objc func growSize() {
        resizeByScale(1.1)
    }
    
    private func resizeByScale(_ scale: CGFloat) {
        let current = overlayWindow.frame
        let newW = max(200, current.width * scale)
        let newH = max(160, current.height * scale)
        let newFrame = NSRect(
            x: current.midX - newW / 2.0,
            y: current.midY - newH / 2.0,
            width: newW,
            height: newH
        )
        overlayWindow.setFrame(newFrame, display: true, animate: true)
    }
    
    @objc func presetFullScreen() {
        guard let screen = overlayWindow.screen ?? NSScreen.main else { return }
        overlayWindow.setFrame(screen.frame, display: true, animate: true)
    }
    
    @objc func preset16by9() {
        let currentFrame = overlayWindow.frame
        let newHeight = currentFrame.width * (9.0 / 16.0)
        let newFrame = NSRect(x: currentFrame.origin.x, y: currentFrame.midY - newHeight / 2.0, width: currentFrame.width, height: newHeight)
        overlayWindow.setFrame(newFrame, display: true, animate: true)
    }
    
    @objc func preset4by3() {
        let currentFrame = overlayWindow.frame
        let newHeight = currentFrame.width * (3.0 / 4.0)
        let newFrame = NSRect(x: currentFrame.origin.x, y: currentFrame.midY - newHeight / 2.0, width: currentFrame.width, height: newHeight)
        overlayWindow.setFrame(newFrame, display: true, animate: true)
    }
    
    @objc func preset1by1() {
        let currentFrame = overlayWindow.frame
        let size = min(currentFrame.width, currentFrame.height)
        let newFrame = NSRect(x: currentFrame.midX - size / 2.0, y: currentFrame.midY - size / 2.0, width: size, height: size)
        overlayWindow.setFrame(newFrame, display: true, animate: true)
    }
    
    @objc func presetCenter() {
        overlayWindow.center()
    }
    
    @objc func quitApp() {
        NSApp.terminate(nil)
    }
}

// MARK: - AppDelegate & Ciclo de Vida
class AppDelegate: NSObject, NSApplicationDelegate {
    var overlayWindow: OverlayWindow!
    var menuBarController: MenuBarController!
    
    func applicationDidFinishLaunching(_ notification: Notification) {
        overlayWindow = OverlayWindow()
        overlayWindow.makeKeyAndOrderFront(nil)
        overlayWindow.orderFrontRegardless()
        
        menuBarController = MenuBarController(overlayWindow: overlayWindow)
    }
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.setActivationPolicy(.accessory)
app.run()

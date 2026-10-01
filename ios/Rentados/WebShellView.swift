import SwiftUI
import UIKit
import WebKit

enum LocalApp {
    #if DEBUG
    static let url = URL(string: "http://192.168.1.60:5578")!
    static let pushDevicesURL = URL(string: "http://192.168.1.60:3000/api/v1/resident/push-devices")!
    static let offlineMessage = "En la Mac tiene que estar corriendo el servidor local, en el puerto 5578."
    #else
    static let url = URL(string: "https://rentados.app")!
    static let pushDevicesURL = URL(string: "https://rentados-backend.onrender.com/api/v1/resident/push-devices")!
    static let offlineMessage = "Revisa tu conexión e intenta de nuevo."
    #endif
}

struct WebShellView: View {
    @State private var attempt = 0
    @State private var failed = false

    var body: some View {
        ZStack {
            WebView(url: LocalApp.url, failed: $failed)
                .id(attempt)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            if failed {
                VStack(spacing: 16) {
                    Text("No se pudo abrir Rentados")
                        .font(.headline)
                    Text(LocalApp.offlineMessage)
                        .font(.subheadline)
                        .multilineTextAlignment(.center)
                        .foregroundStyle(.secondary)
                    Button("Reintentar") {
                        failed = false
                        attempt += 1
                    }
                    .buttonStyle(.borderedProminent)
                }
                .padding(24)
                .frame(maxWidth: 360)
            }
        }
    }
}

struct WebView: UIViewRepresentable {
    let url: URL
    @Binding var failed: Bool

    func makeCoordinator() -> Coordinator {
        Coordinator(failed: $failed)
    }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        let controller = WKUserContentController()
        controller.add(context.coordinator, name: "openExternal")
        controller.add(context.coordinator, name: "pushSession")
        controller.add(context.coordinator, name: "authSession")
        let storedAuth = UserDefaults.standard.string(forKey: Self.authSessionDefaultsKey) ?? ""
        controller.addUserScript(WKUserScript(
            source: Self.openExternalScript,
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        ))
        controller.addUserScript(WKUserScript(
            source: Self.pushSessionScript,
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        ))
        controller.addUserScript(WKUserScript(
            source: Self.authBridgeScript(storedSession: storedAuth),
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        ))
        configuration.userContentController = controller

        let webView = SafeAreaWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        webView.allowsBackForwardNavigationGestures = true
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.isOpaque = false
        webView.backgroundColor = .clear
        Self.loadFresh(webView: webView, url: url)
        return webView
    }

    private static let webCacheVersionKey = "rentados_web_cache_version"

    private static var webCacheVersion: String {
        let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "0"
        let build = Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "0"
        return "\(version).\(build)"
    }

    /// Evita que WKWebView sirva HTML/JS viejos tras un deploy en Hostinger.
    private static func loadFresh(webView: WKWebView, url: URL) {
        let performLoad = {
            var request = URLRequest(url: url)
            request.cachePolicy = .reloadIgnoringLocalCacheData
            webView.load(request)
        }

        let stored = UserDefaults.standard.string(forKey: webCacheVersionKey)
        let current = webCacheVersion
        guard stored != current else {
            performLoad()
            return
        }

        let dataStore = WKWebsiteDataStore.default()
        let types = WKWebsiteDataStore.allWebsiteDataTypes()
        dataStore.fetchDataRecords(ofTypes: types) { records in
            let rentadosRecords = records.filter {
                $0.displayName.localizedCaseInsensitiveContains("rentados")
            }
            let group = DispatchGroup()
            for record in rentadosRecords {
                group.enter()
                dataStore.removeData(ofTypes: types, for: [record]) {
                    group.leave()
                }
            }
            group.notify(queue: .main) {
                UserDefaults.standard.set(current, forKey: webCacheVersionKey)
                performLoad()
            }
        }
    }

    private static let pushSessionScript = """
    (function () {
      if (window.__rentadosPushWatch) return;
      window.__rentadosPushWatch = true;
      var handler = window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.pushSession;
      if (!handler) return;
      var last = '';
      function tick() {
        var current = '';
        try { current = localStorage.getItem('rentados_token') || ''; } catch (e) {}
        if (current && current !== last) {
          last = current;
          handler.postMessage(current);
        }
      }
      setInterval(tick, 2000);
      tick();
    })();
    """

    private static let authSessionDefaultsKey = "rentados_auth_session"

    private static func authBridgeScript(storedSession: String) -> String {
        let rawLiteral = storedSession
            .replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: "'", with: "\\'")
            .replacingOccurrences(of: "\n", with: "\\n")
        return """
        (function () {
          window.RentadosNative = window.RentadosNative || {};
          var handler = window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.authSession;
          if (handler) {
            window.RentadosNative.persistAuthSession = function (raw) {
              handler.postMessage({ action: 'persist', payload: String(raw || '') });
            };
            window.RentadosNative.clearAuthSession = function () {
              handler.postMessage({ action: 'clear' });
            };
          }
          var raw = '\(rawLiteral)';
          if (!raw) return;
          try {
            if (!localStorage.getItem('rentados_token')) {
              var session = JSON.parse(raw);
              localStorage.setItem('rentados_token', session.token);
              localStorage.setItem('rentados_auth', raw);
            }
          } catch (error) {}
        })();
        """
    }

    private static let openExternalScript = """
    (function () {
      var native = window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.openExternal;
      if (!native || window.__rentadosOpenExternal) return;
      window.__rentadosOpenExternal = true;
      var original = window.open;
      window.open = function (url) {
        try {
          var resolved = new URL(String(url || ''), window.location.href);
          if (resolved.host && resolved.host !== window.location.host) {
            native.postMessage(resolved.toString());
            return null;
          }
        } catch (error) {}
        return original.apply(window, arguments);
      };
    })();
    """

    func updateUIView(_ webView: WKWebView, context: Context) {}

    func sizeThatFits(_ proposal: ProposedViewSize, uiView: WKWebView, context: Context) -> CGSize? {
        proposal.replacingUnspecifiedDimensions()
    }

    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
        @Binding var failed: Bool
        weak var webView: WKWebView?
        private var observingPush = false
        private var authToken = ""
        private var uploadedPair = ""

        init(failed: Binding<Bool>) {
            _failed = failed
        }

        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            if message.name == "authSession" {
                guard let body = message.body as? [String: Any],
                      let action = body["action"] as? String else { return }
                if action == "persist", let payload = body["payload"] as? String, !payload.isEmpty {
                    UserDefaults.standard.set(payload, forKey: WebView.authSessionDefaultsKey)
                } else if action == "clear" {
                    UserDefaults.standard.removeObject(forKey: WebView.authSessionDefaultsKey)
                }
                return
            }
            guard let raw = message.body as? String else { return }
            if message.name == "pushSession" {
                authToken = raw
                uploadPushToken()
                return
            }
            guard message.name == "openExternal" else { return }
            ExternalLink.open(raw)
        }

        func webView(
            _ webView: WKWebView,
            createWebViewWith configuration: WKWebViewConfiguration,
            for navigationAction: WKNavigationAction,
            windowFeatures: WKWindowFeatures
        ) -> WKWebView? {
            if let url = navigationAction.request.url, ExternalLink.shouldLeaveApp(url) {
                ExternalLink.open(url)
            }
            return nil
        }

        func webView(
            _ webView: WKWebView,
            decidePolicyFor navigationAction: WKNavigationAction,
            decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
        ) {
            let frame = navigationAction.targetFrame
            let isMainOrNewWindow = frame == nil || frame?.isMainFrame == true
            if let url = navigationAction.request.url, isMainOrNewWindow, ExternalLink.shouldLeaveApp(url) {
                ExternalLink.open(url)
                decisionHandler(.cancel)
                return
            }
            decisionHandler(.allow)
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            failed = false
            self.webView = webView
            (webView as? SafeAreaWebView)?.refreshSafeArea()
            deliverPushToken(to: webView)
            guard !observingPush else { return }
            observingPush = true
            NotificationCenter.default.addObserver(
                self,
                selector: #selector(pushTokenDidChange),
                name: .rentadosPushToken,
                object: nil
            )
        }

        @objc private func pushTokenDidChange() {
            uploadPushToken()
            guard let webView else { return }
            deliverPushToken(to: webView)
        }

        private func deliverPushToken(to webView: WKWebView) {
            guard let token = PushTokenStore.token else { return }
            let escaped = token
                .replacingOccurrences(of: "\\", with: "\\\\")
                .replacingOccurrences(of: "'", with: "\\'")
            let js = "window.rentadosRegisterIosPush && window.rentadosRegisterIosPush('\(escaped)');"
            webView.evaluateJavaScript(js, completionHandler: nil)
            uploadPushToken()
        }

        private func uploadPushToken() {
            guard let fcmToken = PushTokenStore.token, !fcmToken.isEmpty, !authToken.isEmpty else { return }
            let pair = "\(authToken)|\(fcmToken)"
            guard pair != uploadedPair else { return }
            uploadedPair = pair
            var request = URLRequest(url: LocalApp.pushDevicesURL)
            request.httpMethod = "POST"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.setValue("Bearer \(authToken)", forHTTPHeaderField: "Authorization")
            request.httpBody = try? JSONSerialization.data(withJSONObject: [
                "platform": "ios",
                "token": fcmToken,
            ])
            URLSession.shared.dataTask(with: request) { _, response, _ in
                let status = (response as? HTTPURLResponse)?.statusCode ?? 0
                if status != 201 && status != 200 {
                    DispatchQueue.main.async {
                        if self.uploadedPair == pair {
                            self.uploadedPair = ""
                        }
                    }
                }
            }.resume()
        }

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            if Self.isCancellation(error) { return }
            failed = true
        }

        func webView(
            _ webView: WKWebView,
            didFailProvisionalNavigation navigation: WKNavigation!,
            withError error: Error
        ) {
            if Self.isCancellation(error) { return }
            failed = true
        }

        private static func isCancellation(_ error: Error) -> Bool {
            let nsError = error as NSError
            return nsError.domain == NSURLErrorDomain && nsError.code == NSURLErrorCancelled
        }
    }
}

enum ExternalLink {
    private static let appHosts: Set<String> = {
        var hosts: Set<String> = ["rentados.app", "www.rentados.app", "localhost", "127.0.0.1"]
        if let host = LocalApp.url.host?.lowercased(), !host.isEmpty {
            hosts.insert(host)
        }
        return hosts
    }()

    static func shouldLeaveApp(_ url: URL) -> Bool {
        let scheme = (url.scheme ?? "").lowercased()
        if ["tel", "mailto", "sms", "whatsapp", "facetime"].contains(scheme) {
            return true
        }
        guard scheme == "http" || scheme == "https" else { return false }
        let host = (url.host ?? "").lowercased()
        if host.isEmpty || appHosts.contains(host) {
            return false
        }
        return true
    }

    static func open(_ raw: String) {
        guard let url = URL(string: raw), shouldLeaveApp(url) else { return }
        open(url)
    }

    static func open(_ url: URL) {
        DispatchQueue.main.async {
            UIApplication.shared.open(url, options: [:], completionHandler: nil)
        }
    }
}

final class SafeAreaWebView: WKWebView {
    private var appliedSafeArea = ""

    override func safeAreaInsetsDidChange() {
        super.safeAreaInsetsDidChange()
        applySafeArea()
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        applySafeArea()
    }

    func refreshSafeArea() {
        appliedSafeArea = ""
        applySafeArea()
    }

    private func applySafeArea() {
        guard window != nil else { return }
        let viewInsets = safeAreaInsets
        let windowInsets = window?.safeAreaInsets ?? .zero
        let insets = UIEdgeInsets(
            top: max(viewInsets.top, windowInsets.top),
            left: max(viewInsets.left, windowInsets.left),
            bottom: max(viewInsets.bottom, windowInsets.bottom),
            right: max(viewInsets.right, windowInsets.right)
        )
        let height = Int(bounds.height.rounded())
        guard height > 0 || insets.top > 0 || insets.bottom > 0 || insets.left > 0 || insets.right > 0 else { return }
        let navDockBottom = insets.bottom + 10
        let residentEdgeTop = max(8, Int(insets.top.rounded()) + 6)
        let signature = "\(insets.top),\(insets.right),\(insets.bottom),\(insets.left),\(height),\(navDockBottom),\(residentEdgeTop)"
        guard signature != appliedSafeArea else { return }
        appliedSafeArea = signature
        let js = """
        document.documentElement.classList.add('rentados-native-shell');
        document.documentElement.style.setProperty('--safe-top', '\(insets.top)px');
        document.documentElement.style.setProperty('--safe-right', '\(insets.right)px');
        document.documentElement.style.setProperty('--safe-bottom', '\(insets.bottom)px');
        document.documentElement.style.setProperty('--safe-left', '\(insets.left)px');
        document.documentElement.style.setProperty('--screen-height', '\(height)px');
        document.documentElement.style.setProperty('--resident-nav-dock-bottom', '\(navDockBottom)px');
        document.documentElement.style.setProperty('--resident-edge-top', '\(residentEdgeTop)px');
        if (window.__rentadosSyncViewport) window.__rentadosSyncViewport();
        """
        evaluateJavaScript(js, completionHandler: nil)
    }
}

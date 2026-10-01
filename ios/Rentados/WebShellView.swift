import AVFoundation
import SwiftUI
import UIKit
import WebKit
import PhotosUI
import UniformTypeIdentifiers

enum LocalApp {
    #if DEBUG
    static let url = URL(string: "http://192.168.1.60:5578")!
    static let pushDevicesURL = URL(string: "http://192.168.1.60:3000/api/v1/resident/push-devices")!
    static let offlineMessage = "En la Mac tiene que estar corriendo el servidor local, en el puerto 5578."
    #else
    static let url = URL(string: "https://rentados.app/")!
    static let pushDevicesURL = URL(string: "https://rentados-backend.onrender.com/api/v1/resident/push-devices")!
    static let offlineMessage = "Revisa tu conexión e intenta de nuevo."
    #endif
}

struct WebShellView: View {
    @Environment(\.scenePhase) private var scenePhase
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
        .onChange(of: scenePhase) { _, phase in
            if phase == .active {
                NotificationCenter.default.post(name: .rentadosAppDidBecomeActive, object: nil)
            }
        }
    }
}

extension Notification.Name {
    static let rentadosAppDidBecomeActive = Notification.Name("rentadosAppDidBecomeActive")
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
        controller.add(context.coordinator, name: "appBadge")
        controller.add(context.coordinator, name: "pickPhoto")
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
        controller.addUserScript(WKUserScript(
            source: Self.appBadgeScript,
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        ))
        controller.addUserScript(WKUserScript(
            source: Self.deployWatcherScript,
            injectionTime: .atDocumentEnd,
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
            request.cachePolicy = .reloadIgnoringLocalAndRemoteCacheData
            request.setValue("no-cache", forHTTPHeaderField: "Cache-Control")
            request.setValue("no-cache", forHTTPHeaderField: "Pragma")
            webView.load(request)
        }

        let stored = UserDefaults.standard.string(forKey: webCacheVersionKey)
        let current = webCacheVersion
        guard stored != current else {
            performLoad()
            return
        }

        let dataStore = WKWebsiteDataStore.default()
        let types: Set<String> = [
            WKWebsiteDataTypeDiskCache,
            WKWebsiteDataTypeMemoryCache,
            WKWebsiteDataTypeFetchCache,
            WKWebsiteDataTypeOfflineWebApplicationCache,
        ]
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

    private static let appBadgeScript = """
    (function () {
      window.RentadosNative = window.RentadosNative || {};
      var handler = window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.appBadge;
      if (!handler) return;
      window.RentadosNative.setAppBadge = function (count) {
        handler.postMessage(String(count == null ? 0 : count));
      };
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
            var session = JSON.parse(raw);
            if (!session || !session.token) return;
            if (!localStorage.getItem('rentados_token')) {
              localStorage.setItem('rentados_token', session.token);
            }
            localStorage.setItem('rentados_auth', raw);
          } catch (error) {}
        })();
        """
    }

    private static let deployWatcherScript = """
    (function () {
      if (window.__rentadosDeployWatch) return;
      window.__rentadosDeployWatch = true;
      function moduleScriptSrc() {
        var el = document.querySelector('script[type="module"][src*="/assets/index-"]');
        return el ? el.getAttribute('src') || '' : '';
      }
      var bootBuildEl = document.querySelector('meta[name="rentados-build"]');
      var bootBuild = bootBuildEl ? bootBuildEl.content : '';
      function check() {
        fetch('/index.html?_=' + Date.now(), { cache: 'no-store', credentials: 'same-origin' })
          .then(function (r) { return r.text(); })
          .then(function (html) {
            var buildMatch = html.match(/name="rentados-build"\\s+content="([^"]+)"/);
            if (buildMatch && bootBuild && buildMatch[1] !== bootBuild) {
              location.reload();
              return;
            }
            var assetMatch = html.match(/src="(\\/assets\\/index-[^"]+\\.js)"/);
            var remoteAsset = assetMatch ? assetMatch[1] : '';
            var localAsset = moduleScriptSrc();
            if (remoteAsset && localAsset && remoteAsset !== localAsset) {
              location.reload();
            }
          })
          .catch(function () {});
      }
      document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'visible') check();
      });
      window.__rentadosCheckDeploy = check;
      setTimeout(check, 800);
    })();
    """

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
        private var filePickCompletion: (([URL]?) -> Void)?

        init(failed: Binding<Bool>) {
            _failed = failed
            super.init()
            NotificationCenter.default.addObserver(
                self,
                selector: #selector(appDidBecomeActive),
                name: .rentadosAppDidBecomeActive,
                object: nil
            )
        }

        deinit {
            NotificationCenter.default.removeObserver(self)
        }

        @objc private func appDidBecomeActive() {
            webView?.evaluateJavaScript(
                "window.__rentadosCheckDeploy && window.__rentadosCheckDeploy();",
                completionHandler: nil
            )
        }

        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            if message.name == "appBadge" {
                let count = Int(message.body as? String ?? "") ?? 0
                DispatchQueue.main.async {
                    UIApplication.shared.applicationIconBadgeNumber = max(0, count)
                }
                return
            }
            if message.name == "pickPhoto" {
                presentPhotoChoices { [weak self] urls in
                    guard let self, let webView = self.webView, let url = urls?.first else { return }
                    guard let data = try? Data(contentsOf: url) else { return }
                    let encoded = data.base64EncodedString()
                    let js = "window.rentadosApplyPickedPhoto && window.rentadosApplyPickedPhoto('data:image/jpeg;base64,\(encoded)')"
                    webView.evaluateJavaScript(js, completionHandler: nil)
                }
                return
            }
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
                let existing = UserDefaults.standard.string(forKey: WebView.authSessionDefaultsKey) ?? ""
                if !existing.contains(raw) {
                    let payload = "{\"token\":\"\(raw.replacingOccurrences(of: "\\", with: "\\\\").replacingOccurrences(of: "\"", with: "\\\""))\"}"
                    UserDefaults.standard.set(payload, forKey: WebView.authSessionDefaultsKey)
                }
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

        @available(iOS 18.4, *)
        func webView(
            _ webView: WKWebView,
            runOpenPanelWith parameters: WKOpenPanelParameters,
            initiatedByFrame frame: WKFrameInfo,
            completionHandler: @escaping ([URL]?) -> Void
        ) {
            presentPhotoChoices(completion: completionHandler)
        }

        private func presentPhotoChoices(completion: @escaping ([URL]?) -> Void) {
            if filePickCompletion != nil {
                completion(nil)
                return
            }
            filePickCompletion = completion
            let sheet = UIAlertController(title: "Foto del paquete", message: nil, preferredStyle: .actionSheet)
            if UIImagePickerController.isSourceTypeAvailable(.camera) {
                sheet.addAction(UIAlertAction(title: "Tomar foto", style: .default) { [weak self] _ in
                    self?.openCamera()
                })
            }
            sheet.addAction(UIAlertAction(title: "Elegir de fotos", style: .default) { [weak self] _ in
                self?.openPhotoLibrary()
            })
            sheet.addAction(UIAlertAction(title: "Elegir archivo", style: .default) { [weak self] _ in
                self?.openImageFile()
            })
            sheet.addAction(UIAlertAction(title: "Cancelar", style: .cancel) { [weak self] _ in
                self?.finishFilePick(nil)
            })
            guard let host = Self.topViewController() else {
                finishFilePick(nil)
                return
            }
            if let popover = sheet.popoverPresentationController {
                popover.sourceView = host.view
                popover.sourceRect = CGRect(x: host.view.bounds.midX, y: host.view.bounds.maxY - 1, width: 1, height: 1)
            }
            host.present(sheet, animated: true)
        }

        private func openCamera() {
            guard UIImagePickerController.isSourceTypeAvailable(.camera) else {
                showSimpleAlert(
                    title: "Cámara no disponible",
                    message: "Este dispositivo no tiene cámara o no se puede usar."
                )
                finishFilePick(nil)
                return
            }
            ensureCameraAccess { [weak self] granted in
                guard let self else { return }
                guard granted else {
                    self.finishFilePick(nil)
                    return
                }
                let picker = UIImagePickerController()
                picker.sourceType = .camera
                picker.cameraCaptureMode = .photo
                picker.delegate = self
                self.presentPicker(picker)
            }
        }

        private func ensureCameraAccess(then: @escaping (Bool) -> Void) {
            switch AVCaptureDevice.authorizationStatus(for: .video) {
            case .authorized:
                then(true)
            case .notDetermined:
                AVCaptureDevice.requestAccess(for: .video) { granted in
                    DispatchQueue.main.async {
                        if !granted {
                            self.showCameraSettingsAlert()
                        }
                        then(granted)
                    }
                }
            case .denied, .restricted:
                showCameraSettingsAlert()
                then(false)
            @unknown default:
                then(false)
            }
        }

        private func showCameraSettingsAlert() {
            showSimpleAlert(
                title: "Permiso de cámara",
                message: "Activa la cámara para Rentados en Ajustes → Rentados.",
                settingsButton: true
            )
        }

        private func showSimpleAlert(title: String, message: String, settingsButton: Bool = false) {
            guard let host = Self.topViewController() else { return }
            let alert = UIAlertController(title: title, message: message, preferredStyle: .alert)
            alert.addAction(UIAlertAction(title: "Entendido", style: .cancel))
            if settingsButton {
                alert.addAction(UIAlertAction(title: "Abrir Ajustes", style: .default) { _ in
                    if let url = URL(string: UIApplication.openSettingsURLString) {
                        UIApplication.shared.open(url)
                    }
                })
            }
            if let presented = host.presentedViewController {
                presented.dismiss(animated: true) {
                    host.present(alert, animated: true)
                }
            } else {
                host.present(alert, animated: true)
            }
        }

        private func openPhotoLibrary() {
            var config = PHPickerConfiguration(photoLibrary: .shared())
            config.filter = .images
            config.selectionLimit = 1
            let picker = PHPickerViewController(configuration: config)
            picker.delegate = self
            presentPicker(picker)
        }

        private func openImageFile() {
            let picker = UIDocumentPickerViewController(forOpeningContentTypes: [.image], asCopy: true)
            picker.delegate = self
            picker.allowsMultipleSelection = false
            presentPicker(picker)
        }

        private func presentPicker(_ controller: UIViewController) {
            DispatchQueue.main.async {
                guard let host = Self.topViewController() else {
                    self.finishFilePick(nil)
                    return
                }
                let present = {
                    host.present(controller, animated: true)
                }
                if let sheet = host.presentedViewController {
                    sheet.dismiss(animated: true, completion: present)
                } else {
                    present()
                }
            }
        }

        private func finishFilePick(_ urls: [URL]?) {
            let handler = filePickCompletion
            filePickCompletion = nil
            handler?(urls)
        }

        private static func topViewController() -> UIViewController? {
            let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
            let window = scenes.flatMap(\.windows).first { $0.isKeyWindow }
            var current = window?.rootViewController
            while let presented = current?.presentedViewController {
                current = presented
            }
            return current
        }

        private static func writeTempJPEG(_ image: UIImage) -> URL? {
            guard let data = image.jpegData(compressionQuality: 0.85) else { return nil }
            let url = FileManager.default.temporaryDirectory.appendingPathComponent("rentados-\(UUID().uuidString).jpg")
            do {
                try data.write(to: url, options: .atomic)
                return url
            } catch {
                return nil
            }
        }

        private static func jpegURL(fromFile url: URL) -> URL? {
            if let image = UIImage(contentsOfFile: url.path), let jpeg = writeTempJPEG(image) {
                return jpeg
            }
            let copy = FileManager.default.temporaryDirectory.appendingPathComponent("rentados-\(UUID().uuidString).jpg")
            do {
                if FileManager.default.fileExists(atPath: copy.path) {
                    try FileManager.default.removeItem(at: copy)
                }
                try FileManager.default.copyItem(at: url, to: copy)
                return copy
            } catch {
                return nil
            }
        }

        private static func isCancellation(_ error: Error) -> Bool {
            let nsError = error as NSError
            return nsError.domain == NSURLErrorDomain && nsError.code == NSURLErrorCancelled
        }
    }
}

extension WebView.Coordinator: UIImagePickerControllerDelegate, UINavigationControllerDelegate, PHPickerViewControllerDelegate, UIDocumentPickerDelegate {
    func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
        picker.dismiss(animated: true) { self.finishFilePick(nil) }
    }

    func imagePickerController(
        _ picker: UIImagePickerController,
        didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]
    ) {
        let image = info[.originalImage] as? UIImage
        picker.dismiss(animated: true) {
            guard let image, let url = Self.writeTempJPEG(image) else {
                self.finishFilePick(nil)
                return
            }
            self.finishFilePick([url])
        }
    }

    func picker(_ picker: PHPickerViewController, didFinishPicking results: [PHPickerResult]) {
        picker.dismiss(animated: true)
        guard let provider = results.first?.itemProvider else {
            finishFilePick(nil)
            return
        }
        let type = UTType.image.identifier
        guard provider.hasItemConformingToTypeIdentifier(type) else {
            finishFilePick(nil)
            return
        }
        provider.loadFileRepresentation(forTypeIdentifier: type) { url, _ in
            let jpeg = url.flatMap { Self.jpegURL(fromFile: $0) }
            DispatchQueue.main.async {
                self.finishFilePick(jpeg.map { [$0] })
            }
        }
    }

    func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
        finishFilePick(nil)
    }

    func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
        let jpeg = urls.first.flatMap { Self.jpegURL(fromFile: $0) }
        finishFilePick(jpeg.map { [$0] })
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

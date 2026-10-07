import UIKit
import Capacitor

class SceneDelegate: UIResponder, UIWindowSceneDelegate {

    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }
        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = CAPBridgeViewController()
        window?.makeKeyAndVisible()

        // Cold-start deep links: plugins are not ready until the bridge appears.
        if !connectionOptions.urlContexts.isEmpty || !connectionOptions.userActivities.isEmpty {
            var token: NSObjectProtocol?
            token = NotificationCenter.default.addObserver(
                forName: .capacitorViewDidAppear,
                object: nil,
                queue: .main
            ) { _ in
                if let token {
                    NotificationCenter.default.removeObserver(token)
                }
                if !connectionOptions.urlContexts.isEmpty {
                    self.scene(scene, openURLContexts: connectionOptions.urlContexts)
                }
                for userActivity in connectionOptions.userActivities {
                    self.scene(scene, continue: userActivity)
                }
            }
        }
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        for context in URLContexts {
            var options: [UIApplication.OpenURLOptionsKey: Any] = [:]
            if let sourceApplication = context.options.sourceApplication {
                options[.sourceApplication] = sourceApplication
            }
            if let annotation = context.options.annotation {
                options[.annotation] = annotation
            }
            options[.openInPlace] = context.options.openInPlace
            _ = ApplicationDelegateProxy.shared.application(
                UIApplication.shared,
                open: context.url,
                options: options
            )
        }
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        _ = ApplicationDelegateProxy.shared.application(
            UIApplication.shared,
            continue: userActivity,
            restorationHandler: { _ in }
        )
    }
}

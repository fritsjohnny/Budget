import Foundation
import Capacitor

/**
 * Please read the Capacitor iOS Plugin Development Guide
 * here: https://capacitorjs.com/docs/plugins/ios
 */
@objc(BudgetNotifierPluginPlugin)
public class BudgetNotifierPluginPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "BudgetNotifierPluginPlugin"
    public let jsName = "BudgetNotifierPlugin"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "echo", returnType: CAPPluginReturnPromise)
    ]
    private let implementation = BudgetNotifierPlugin()

    @objc func echo(_ call: CAPPluginCall) {
        let value = call.getString("value") ?? ""
        call.resolve([
            "value": implementation.echo(value)
        ])
    }
}

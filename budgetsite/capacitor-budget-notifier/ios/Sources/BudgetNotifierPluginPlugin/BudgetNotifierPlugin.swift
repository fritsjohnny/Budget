import Foundation

@objc public class BudgetNotifierPlugin: NSObject {
    @objc public func echo(_ value: String) -> String {
        print(value)
        return value
    }
}

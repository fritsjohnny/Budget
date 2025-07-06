// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "CapacitorNotificationReader",
    platforms: [.iOS(.v14)],
    products: [
        .library(
            name: "CapacitorNotificationReader",
            targets: ["NotificationReaderPluginPlugin"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", from: "7.0.0")
    ],
    targets: [
        .target(
            name: "NotificationReaderPluginPlugin",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm")
            ],
            path: "ios/Sources/NotificationReaderPluginPlugin"),
        .testTarget(
            name: "NotificationReaderPluginPluginTests",
            dependencies: ["NotificationReaderPluginPlugin"],
            path: "ios/Tests/NotificationReaderPluginPluginTests")
    ]
)
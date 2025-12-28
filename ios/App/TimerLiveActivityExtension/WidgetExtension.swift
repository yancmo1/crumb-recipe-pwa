import Foundation

// WidgetKit extensions still expect an Objective-C visible principal class via Info.plist.
// The SwiftUI widgets are provided by the @main WidgetBundle.
@objc(WidgetExtension)
final class WidgetExtension: NSObject {}

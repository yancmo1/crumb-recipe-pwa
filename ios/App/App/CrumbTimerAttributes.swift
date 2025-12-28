import Foundation
import ActivityKit

// Shared between the main app target and the Live Activity widget extension.
// Both targets must compile this exact type so ActivityKit can render the activity.

public struct CrumbTimerAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        public var recipeTitle: String
        public var stepIndex: Int
        public var stepText: String
        public var startTime: Date
        public var endTime: Date
        public var imageUrl: String?
        public var widgetUrl: String?

        public init(
            recipeTitle: String,
            stepIndex: Int,
            stepText: String,
            startTime: Date,
            endTime: Date,
            imageUrl: String? = nil,
            widgetUrl: String? = nil
        ) {
            self.recipeTitle = recipeTitle
            self.stepIndex = stepIndex
            self.stepText = stepText
            self.startTime = startTime
            self.endTime = endTime
            self.imageUrl = imageUrl
            self.widgetUrl = widgetUrl
        }
    }

    public var id: String

    public init(id: String) {
        self.id = id
    }
}

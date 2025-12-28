import Foundation
import Capacitor
import ActivityKit

// Live Activities are only available on iOS 16.1+.
// We compile with iOS 15 deployment target for the app, so all ActivityKit usage
// must be wrapped in availability checks.

@objc(LiveActivitiesPlugin)
public class LiveActivitiesPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "LiveActivitiesPlugin"
    public let jsName = "LiveActivities"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isSupported", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "startTimer", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "endTimer", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "endAll", returnType: CAPPluginReturnPromise)
    ]

    @objc func isSupported(_ call: CAPPluginCall) {
        if #available(iOS 16.1, *) {
            // Live Activities can be disabled system-wide or per-app.
            // Report the actual availability so the JS layer can avoid silent failures.
            let auth = ActivityAuthorizationInfo()
            call.resolve([
                "supported": auth.areActivitiesEnabled
            ])
        } else {
            call.resolve([
                "supported": false
            ])
        }
    }

    @objc func startTimer(_ call: CAPPluginCall) {
        if #available(iOS 16.1, *) {
            startTimerImpl(call)
        } else {
            call.resolve(["activityId": NSNull()])
        }
    }

    @objc func endTimer(_ call: CAPPluginCall) {
        if #available(iOS 16.1, *) {
            endTimerImpl(call)
        } else {
            call.resolve()
        }
    }

    @objc func endAll(_ call: CAPPluginCall) {
        if #available(iOS 16.1, *) {
            Task {
                await LiveActivitiesPlugin.endAllActivities()
                call.resolve()
            }
        } else {
            call.resolve()
        }
    }
}

@available(iOS 16.1, *)
private extension LiveActivitiesPlugin {
    func startTimerImpl(_ call: CAPPluginCall) {
        let auth = ActivityAuthorizationInfo()
        if !auth.areActivitiesEnabled {
            CAPLog.print("[LiveActivities] Activities disabled (areActivitiesEnabled=false)")
            call.resolve(["activityId": NSNull()])
            return
        }

        guard let recipeTitle = call.getString("recipeTitle") else {
            call.reject("Missing recipeTitle")
            return
        }

        let stepIndex = call.getInt("stepIndex") ?? 0
        let stepText = call.getString("stepText") ?? ""

        // endTimeMs comes from JS Date.now() ms.
        guard let endTimeMs = call.getDouble("endTimeMs") else {
            call.reject("Missing endTimeMs")
            return
        }

        let widgetUrl = call.getString("widgetUrl")
        let imageUrl = call.getString("imageUrl")

        let now = Date()
        let endTime = Date(timeIntervalSince1970: endTimeMs / 1000.0)

        // If the end time is in the past, don't start a live activity.
        if endTime <= now {
            call.resolve(["activityId": NSNull()])
            return
        }

        Task {
            // Keep things simple: only allow one timer live activity at a time.
            await LiveActivitiesPlugin.endAllActivities()

            let attributes = CrumbTimerAttributes(id: "crumb-timer")
            let state = CrumbTimerAttributes.ContentState(
                recipeTitle: recipeTitle,
                stepIndex: stepIndex,
                stepText: stepText,
                startTime: now,
                endTime: endTime,
                imageUrl: imageUrl,
                widgetUrl: widgetUrl
            )

            do {
                let activity = try LiveActivitiesPlugin.requestActivity(attributes: attributes, state: state)
                CAPLog.print("[LiveActivities] Started activity id=\(activity.id) step=\(stepIndex + 1)")
                call.resolve(["activityId": activity.id])
            } catch {
                CAPLog.print("[LiveActivities] Failed to start: \(error)")
                call.resolve(["activityId": NSNull()])
            }
        }
    }

    func endTimerImpl(_ call: CAPPluginCall) {
        let activityId = call.getString("activityId")
        Task {
            if let activityId {
                await LiveActivitiesPlugin.endActivity(id: activityId)
            }
            call.resolve()
        }
    }

    static func requestActivity(attributes: CrumbTimerAttributes, state: CrumbTimerAttributes.ContentState) throws -> Activity<CrumbTimerAttributes> {
        // Activity.request API differs slightly across iOS versions.
        if #available(iOS 16.2, *) {
            return try Activity.request(
                attributes: attributes,
                contentState: state,
                pushType: nil
            )
        }

        return try Activity.request(
            attributes: attributes,
            contentState: state
        )
    }

    static func endAllActivities() async {
        for activity in Activity<CrumbTimerAttributes>.activities {
            CAPLog.print("[LiveActivities] Ending activity id=\(activity.id)")
            if #available(iOS 16.2, *) {
                await activity.end(nil, dismissalPolicy: .immediate)
            } else {
                await activity.end(dismissalPolicy: .immediate)
            }
        }
    }

    static func endActivity(id: String) async {
        if let activity = Activity<CrumbTimerAttributes>.activities.first(where: { $0.id == id }) {
            if #available(iOS 16.2, *) {
                await activity.end(nil, dismissalPolicy: .immediate)
            } else {
                await activity.end(dismissalPolicy: .immediate)
            }
        }
    }
}

import ActivityKit
import WidgetKit
import SwiftUI

// Live Activities require iOS 16.1+. This extension target will be set to iOS 16.1.

struct TimerLiveActivityWidget: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: CrumbTimerAttributes.self) { context in
            // Lock screen + banner
            LockScreenTimerView(context: context)
                .activityBackgroundTint(.black.opacity(0.04))
                .activitySystemActionForegroundColor(.primary)
                .widgetURL(timerDeepLinkURL(from: context.state.widgetUrl))
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    RecipeThumb(urlString: context.state.imageUrl)
                        .frame(width: 44, height: 44)
                }

                DynamicIslandExpandedRegion(.trailing) {
                    VStack(alignment: .trailing, spacing: 4) {
                        Text("Step \(context.state.stepIndex + 1)")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        CountdownText(endTime: context.state.endTime)
                            .font(.headline.monospacedDigit())
                    }
                }

                DynamicIslandExpandedRegion(.bottom) {
                    VStack(alignment: .leading, spacing: 8) {
                        Text(context.state.recipeTitle)
                            .font(.headline)
                            .lineLimit(1)
                        Text(context.state.stepText)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .lineLimit(2)

                        TimelineView(.periodic(from: Date(), by: 1)) { _ in
                            ProgressView(value: progress(now: Date(), start: context.state.startTime, end: context.state.endTime))
                                .progressViewStyle(.linear)
                        }
                    }
                    .padding(.top, 2)
                }
            } compactLeading: {
                // “Toast logo” vibe: keep it simple and legible.
                Text("🍞")
            } compactTrailing: {
                CountdownText(endTime: context.state.endTime)
                    .font(.caption2.monospacedDigit())
            } minimal: {
                Text("🍞")
            }
            .widgetURL(timerDeepLinkURL(from: context.state.widgetUrl))
        }
    }
}

private struct LockScreenTimerView: View {
    let context: ActivityViewContext<CrumbTimerAttributes>

    var body: some View {
        HStack(spacing: 12) {
            RecipeThumb(urlString: context.state.imageUrl)
                .frame(width: 52, height: 52)

            VStack(alignment: .leading, spacing: 6) {
                Text(context.state.recipeTitle)
                    .font(.headline)
                    .lineLimit(1)

                Text("Step \(context.state.stepIndex + 1)")
                    .font(.caption)
                    .foregroundStyle(.secondary)

                CountdownText(endTime: context.state.endTime)
                    .font(.title3.monospacedDigit())

                TimelineView(.periodic(from: Date(), by: 1)) { _ in
                    ProgressView(value: progress(now: Date(), start: context.state.startTime, end: context.state.endTime))
                        .progressViewStyle(.linear)
                }
            }
        }
        .padding(.vertical, 8)
        .padding(.horizontal, 12)
    }
}

private struct RecipeThumb: View {
    let urlString: String?

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .fill(.quaternary)

            if let urlString, let url = URL(string: urlString), url.scheme == "https" || url.scheme == "http" {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .success(let image):
                        image
                            .resizable()
                            .scaledToFill()
                    default:
                        Text("🍞")
                            .font(.title2)
                    }
                }
            } else {
                Text("🍞")
                    .font(.title2)
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
    }
}

private struct CountdownText: View {
    let endTime: Date

    var body: some View {
        // Date in the future renders as a countdown.
        Text(endTime, style: .timer)
    }
}

private func progress(now: Date, start: Date, end: Date) -> Double {
    let total = max(1, end.timeIntervalSince(start))
    let elapsed = max(0, now.timeIntervalSince(start))
    return min(1, elapsed / total)
}

private func timerDeepLinkURL(from s: String?) -> URL? {
    guard let s, let url = URL(string: s) else { return nil }
    return url
}

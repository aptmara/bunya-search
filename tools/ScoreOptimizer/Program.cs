using System.Globalization;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.Json.Serialization;

namespace ScoreOptimizer;

internal static class Program
{
    internal static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        ReadCommentHandling = JsonCommentHandling.Skip,
        AllowTrailingCommas = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        Converters = { new JsonStringEnumConverter() }
    };

    private static int Main(string[] args)
    {
        var arguments = ArgumentParser.Parse(args);
        if (!arguments.IsValid)
        {
            PrintUsage();
            return 1;
        }

        try
        {
            var baseDir = AppContext.BaseDirectory;
            var rootDir = Path.GetFullPath(Path.Combine(baseDir, "..", ".."));

            var likertItems = LikertItem.Load(Path.Combine(rootDir, "data", "questions_likert.json"));
            var forcedChoiceItems = ForcedChoiceItem.Load(Path.Combine(rootDir, "data", "questions_forced_choice.json"));
            var scenarioItems = ScenarioItem.Load(Path.Combine(rootDir, "data", "questions_scenario.json"));

            var scorer = new ScoreAnalyzer(likertItems, forcedChoiceItems, scenarioItems);
            var responses = ResponseRecordExtensions.Load(arguments.ResponsesPath);

            if (responses.Count == 0)
            {
                Console.WriteLine("警告: 回答データが空のため、ダミーデータで統計を試算します。");
                responses = ResponseRecordExtensions.GenerateSyntheticSamples(
                    likertItems.Select(i => i.Id),
                    forcedChoiceItems.SelectMany(i => i.Options.Select(o => $"{i.Id}|{o.Key}")));
            }

            var report = scorer.Analyze(responses);

            Directory.CreateDirectory(Path.GetDirectoryName(arguments.OutputPath)!);
            File.WriteAllText(
                arguments.OutputPath,
                JsonSerializer.Serialize(report, new JsonSerializerOptions(JsonSerializerDefaults.Web) { WriteIndented = true }));

            Console.WriteLine($"結果を {arguments.OutputPath} に書き出しました。");

            if (arguments.ApplyWeights)
            {
                WeightApplier.Apply(
                    arguments.Tolerance,
                    report,
                    Path.Combine(rootDir, "data", "questions_forced_choice.json"),
                    Path.Combine(rootDir, "data", "questions_scenario.json"));
            }

            return 0;
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"エラー: {ex.Message}");
            return 1;
        }
    }

    private static void PrintUsage()
    {
        Console.WriteLine("""
            ScoreOptimizer - 診断スコア最適化サポートツール

            使い方:
              dotnet run --project tools/ScoreOptimizer -- --responses <responses.csv> --output <output.json> [--apply] [--tolerance 0.05]

            引数:
              --responses : 回答CSVのパス（列例: RespondentId,ItemId,NumericValue,ResponseTimeMs,Confidence）
              --output    : 推奨重みや統計情報を書き出すJSONのパス
              --apply     : 推奨重みを設問JSONへ反映する場合に指定
              --tolerance : 反映時の差分許容値（既定0.05）
            """);
    }
}

internal record struct Arguments(
    bool IsValid,
    string ResponsesPath,
    string OutputPath,
    bool ApplyWeights,
    double Tolerance);

internal static class ArgumentParser
{
    public static Arguments Parse(string[] args)
    {
        string? responses = null;
        string? output = null;
        var applyWeights = false;
        var tolerance = 0.05;

        for (var i = 0; i < args.Length; i++)
        {
            switch (args[i])
            {
                case "--responses" when i + 1 < args.Length:
                    responses = args[++i];
                    break;
                case "--output" when i + 1 < args.Length:
                    output = args[++i];
                    break;
                case "--apply":
                    applyWeights = true;
                    break;
                case "--tolerance" when i + 1 < args.Length:
                    if (double.TryParse(args[i + 1], NumberStyles.Any, CultureInfo.InvariantCulture, out var tol))
                    {
                        tolerance = tol;
                        i++;
                    }
                    break;
            }
        }

        if (string.IsNullOrWhiteSpace(responses) || string.IsNullOrWhiteSpace(output))
        {
            return new Arguments(false, string.Empty, string.Empty, false, tolerance);
        }

        return new Arguments(true, responses, output, applyWeights, tolerance);
    }
}

internal sealed record LikertItem(
    string Id,
    string Axis,
    string PrimaryCategory,
    string Polarity,
    IReadOnlyList<RelatedCategory> RelatedCategories)
{
    public static IReadOnlyList<LikertItem> Load(string path)
    {
        using var stream = File.OpenRead(path);
        var root = JsonSerializer.Deserialize<LikertRoot>(stream, Program.JsonOptions);
        if (root is null)
        {
            throw new InvalidOperationException("Likert設問データの読み込みに失敗しました。");
        }

        return root.Items.Select(item => new LikertItem(
            item.Id,
            item.Axis,
            item.PrimaryCategory,
            item.Polarity,
            item.RelatedCategories ?? Array.Empty<RelatedCategory>())).ToArray();
    }

    private sealed record LikertRoot(IReadOnlyList<LikertItemDto> Items);

    private sealed record LikertItemDto(
        string Id,
        string Axis,
        string PrimaryCategory,
        string Polarity,
        IReadOnlyList<RelatedCategory>? RelatedCategories);
}

internal sealed record ForcedChoiceItem(
    string Id,
    bool Required,
    IReadOnlyList<ForcedChoiceOption> Options)
{
    public static IReadOnlyList<ForcedChoiceItem> Load(string path)
    {
        using var stream = File.OpenRead(path);
        var root = JsonSerializer.Deserialize<ForcedChoiceRoot>(stream, Program.JsonOptions);
        if (root is null)
        {
            throw new InvalidOperationException("Forced-choice設問データの読み込みに失敗しました。");
        }

        return root.Items.Select(item => new ForcedChoiceItem(
            item.Id,
            item.Required,
            item.Options.Select(opt => new ForcedChoiceOption(
                opt.Key,
                opt.Primary,
                opt.Secondary ?? Array.Empty<WeightedCategory>())).ToArray())).ToArray();
    }
}

internal sealed record ForcedChoiceRoot(IReadOnlyList<ForcedChoiceItemDto> Items);

internal sealed record ForcedChoiceItemDto(
    string Id,
    bool Required,
    IReadOnlyList<ForcedChoiceOptionDto> Options);

internal sealed record ForcedChoiceOptionDto(
    string Key,
    WeightedCategory Primary,
    IReadOnlyList<WeightedCategory>? Secondary);

internal sealed record ForcedChoiceOption(
    string Key,
    WeightedCategory Primary,
    IReadOnlyList<WeightedCategory> Secondary);

internal sealed record ScenarioItem(
    string Id,
    bool Required,
    IReadOnlyList<ScenarioOption> Options)
{
    public static IReadOnlyList<ScenarioItem> Load(string path)
    {
        using var stream = File.OpenRead(path);
        var root = JsonSerializer.Deserialize<ScenarioRoot>(stream, Program.JsonOptions);
        if (root is null)
        {
            throw new InvalidOperationException("シナリオ設問データの読み込みに失敗しました。");
        }

        return root.Items.Select(item => new ScenarioItem(
            item.Id,
            item.Required,
            item.Options.Select(opt => new ScenarioOption(
                opt.Key,
                opt.Primary,
                opt.Secondary ?? Array.Empty<WeightedCategory>())).ToArray())).ToArray();
    }
}

internal sealed record ScenarioRoot(IReadOnlyList<ScenarioItemDto> Items);

internal sealed record ScenarioItemDto(
    string Id,
    bool Required,
    IReadOnlyList<ScenarioOptionDto> Options);

internal sealed record ScenarioOptionDto(
    string Key,
    WeightedCategory Primary,
    IReadOnlyList<WeightedCategory>? Secondary);

internal sealed record ScenarioOption(
    string Key,
    WeightedCategory Primary,
    IReadOnlyList<WeightedCategory> Secondary);

internal sealed record WeightedCategory(string Axis, string Category, double Score, double Weight);

internal sealed record RelatedCategory(string Axis, string Category, double Weight);

internal sealed record ResponseRecord(string RespondentId, string ItemId, double Value, double? ResponseTimeMs, double? Confidence);

internal static class ResponseRecordExtensions
{
    public static List<ResponseRecord> Load(string path)
    {
        if (!File.Exists(path))
        {
            Console.WriteLine($"警告: 指定された回答ファイルが見つかりません ({path})。");
            return new List<ResponseRecord>();
        }

        var records = new List<ResponseRecord>();
        foreach (var line in File.ReadLines(path).Skip(1))
        {
            if (string.IsNullOrWhiteSpace(line))
            {
                continue;
            }

            var tokens = line.Split(',');
            if (tokens.Length < 3)
            {
                continue;
            }

            var respondent = tokens[0].Trim();
            var itemId = tokens[1].Trim();
            if (!double.TryParse(tokens[2], NumberStyles.Any, CultureInfo.InvariantCulture, out var value))
            {
                continue;
            }

            double? responseTime = null;
            if (tokens.Length > 3 && double.TryParse(tokens[3], NumberStyles.Any, CultureInfo.InvariantCulture, out var rt))
            {
                responseTime = rt;
            }

            double? confidence = null;
            if (tokens.Length > 4 && double.TryParse(tokens[4], NumberStyles.Any, CultureInfo.InvariantCulture, out var conf))
            {
                confidence = conf;
            }

            records.Add(new ResponseRecord(respondent, itemId, value, responseTime, confidence));
        }

        return records;
    }

    public static List<ResponseRecord> GenerateSyntheticSamples(IEnumerable<string> likertIds, IEnumerable<string> forcedChoiceIds)
    {
        var rng = new Random(42);
        var respondents = Enumerable.Range(1, 40).Select(i => $"synthetic-{i:D2}");
        var records = new List<ResponseRecord>();

        foreach (var respondent in respondents)
        {
            foreach (var itemId in likertIds)
            {
                records.Add(new ResponseRecord(
                    respondent,
                    itemId,
                    rng.Next(1, 8),
                    rng.Next(12, 35) * 100,
                    rng.NextDouble()));
            }

            foreach (var optionId in forcedChoiceIds)
            {
                records.Add(new ResponseRecord(
                    respondent,
                    optionId,
                    rng.NextDouble() switch
                    {
                        < 0.4 => 1,
                        < 0.7 => 0,
                        _ => -1
                    },
                    rng.Next(10, 25) * 100,
                    rng.NextDouble()));
            }
        }

        return records;
    }
}

internal sealed class ScoreAnalyzer
{
    private readonly IReadOnlyList<LikertItem> _likertItems;
    private readonly IReadOnlyList<ForcedChoiceItem> _forcedChoiceItems;
    private readonly IReadOnlyList<ScenarioItem> _scenarioItems;

    public ScoreAnalyzer(
        IReadOnlyList<LikertItem> likertItems,
        IReadOnlyList<ForcedChoiceItem> forcedChoiceItems,
        IReadOnlyList<ScenarioItem> scenarioItems)
    {
        _likertItems = likertItems;
        _forcedChoiceItems = forcedChoiceItems;
        _scenarioItems = scenarioItems;
    }

    public AnalysisReport Analyze(List<ResponseRecord> responses)
    {
        var likertReport = AnalyzeLikert(responses);
        var fcReport = AnalyzeForcedChoice(responses);
        var scenarioReport = AnalyzeScenario(responses);
        var qualityReport = AnalyzeQuality(responses);

        return new AnalysisReport(likertReport, fcReport, scenarioReport, qualityReport);
    }

    private LikertAnalysis AnalyzeLikert(List<ResponseRecord> responses)
    {
        var itemGroups = responses
            .Where(r => _likertItems.Any(l => l.Id == r.ItemId))
            .GroupBy(r => r.ItemId)
            .ToDictionary(g => g.Key, g => g.ToList());

        var itemSummaries = new List<ItemSummary>();

        foreach (var item in _likertItems)
        {
            if (!itemGroups.TryGetValue(item.Id, out var records))
            {
                continue;
            }

            var values = records.Select(r => r.Value).ToArray();
            var mean = values.Average();
            var variance = values.Length > 1 ? values.Select(v => Math.Pow(v - mean, 2)).Sum() / (values.Length - 1) : 0;
            var correlation = ItemTotalCorrelation(values, responses, item.Id);
            var recommendedWeight = correlation.HasValue ? Clamp(1 + correlation.Value * 0.5, 0.4, 1.6) : 1.0;

            var averageTime = records.Where(r => r.ResponseTimeMs.HasValue).Select(r => r.ResponseTimeMs!.Value).DefaultIfEmpty().Average();
            var averageConfidence = records.Where(r => r.Confidence.HasValue).Select(r => r.Confidence!.Value).DefaultIfEmpty().Average();
            var effectiveWeight = recommendedWeight *
                                   CalculateTimeMultiplier(averageTime) *
                                   CalculateConfidenceMultiplier(averageConfidence);

            itemSummaries.Add(new ItemSummary(
                item.Id,
                item.Axis,
                item.PrimaryCategory,
                mean,
                variance,
                effectiveWeight,
                recommendedWeight,
                correlation,
                double.IsNaN(averageTime) ? null : averageTime,
                double.IsNaN(averageConfidence) ? null : averageConfidence));
        }

        var axisGroups = itemSummaries.GroupBy(s => s.Axis).ToDictionary(g => g.Key, g => g.ToList());
        var axisAlphas = axisGroups.ToDictionary(
            pair => pair.Key,
            pair => CronbachAlpha(pair.Value.Select(v => v.Variance).ToArray(), Math.Max(1, responses.Count / Math.Max(pair.Value.Count, 1))));

        return new LikertAnalysis(itemSummaries, axisAlphas);
    }

    private ForcedChoiceAnalysis AnalyzeForcedChoice(List<ResponseRecord> responses)
    {
        var itemGroups = responses
            .Where(r => r.ItemId.Contains('|'))
            .GroupBy(r => r.ItemId)
            .ToDictionary(g => g.Key, g => g.ToList());

        var summaries = new List<ItemSummary>();
        foreach (var item in _forcedChoiceItems)
        {
            foreach (var option in item.Options)
            {
                var compositeId = $"{item.Id}|{option.Key}";
                if (!itemGroups.TryGetValue(compositeId, out var records))
                {
                    continue;
                }

                var values = records.Select(r => r.Value).ToArray();
                var mean = values.Average();
                var variance = values.Length > 1 ? values.Select(v => Math.Pow(v - mean, 2)).Sum() / (values.Length - 1) : 0;
                var recommendedWeight = Clamp(variance switch
                {
                    > 2 => 1.2,
                    > 1 => 1.0,
                    > 0.5 => 0.8,
                    _ => 0.6
                }, 0.5, 1.4);

                var averageTime = records.Where(r => r.ResponseTimeMs.HasValue).Select(r => r.ResponseTimeMs!.Value).DefaultIfEmpty().Average();
                var averageConfidence = records.Where(r => r.Confidence.HasValue).Select(r => r.Confidence!.Value).DefaultIfEmpty().Average();
                var effectiveWeight = recommendedWeight *
                                       CalculateTimeMultiplier(averageTime) *
                                       CalculateConfidenceMultiplier(averageConfidence);

                summaries.Add(new ItemSummary(
                    compositeId,
                    option.Primary.Axis,
                    option.Primary.Category,
                    mean,
                    variance,
                    effectiveWeight,
                    recommendedWeight,
                    null,
                    double.IsNaN(averageTime) ? null : averageTime,
                    double.IsNaN(averageConfidence) ? null : averageConfidence));
            }
        }

        return new ForcedChoiceAnalysis(summaries);
    }

    private ScenarioAnalysis AnalyzeScenario(List<ResponseRecord> responses)
    {
        var itemGroups = responses
            .Where(r => r.ItemId.StartsWith("SC-"))
            .GroupBy(r => r.ItemId)
            .ToDictionary(g => g.Key, g => g.ToList());

        var summaries = new List<ItemSummary>();
        foreach (var item in _scenarioItems)
        {
            foreach (var option in item.Options)
            {
                var compositeId = $"{item.Id}|{option.Key}";
                if (!itemGroups.TryGetValue(compositeId, out var records))
                {
                    continue;
                }

                var values = records.Select(r => r.Value).ToArray();
                var mean = values.Average();
                var variance = values.Length > 1 ? values.Select(v => Math.Pow(v - mean, 2)).Sum() / (values.Length - 1) : 0;
                var recommendedWeight = Clamp(variance switch
                {
                    > 2 => 1.2,
                    > 1 => 1.0,
                    > 0.5 => 0.8,
                    _ => 0.6
                }, 0.5, 1.4);

                var averageTime = records.Where(r => r.ResponseTimeMs.HasValue).Select(r => r.ResponseTimeMs!.Value).DefaultIfEmpty().Average();
                var averageConfidence = records.Where(r => r.Confidence.HasValue).Select(r => r.Confidence!.Value).DefaultIfEmpty().Average();
                var effectiveWeight = recommendedWeight *
                                       CalculateTimeMultiplier(averageTime) *
                                       CalculateConfidenceMultiplier(averageConfidence);

                summaries.Add(new ItemSummary(
                    compositeId,
                    option.Primary.Axis,
                    option.Primary.Category,
                    mean,
                    variance,
                    effectiveWeight,
                    recommendedWeight,
                    null,
                    double.IsNaN(averageTime) ? null : averageTime,
                    double.IsNaN(averageConfidence) ? null : averageConfidence));
            }
        }

        return new ScenarioAnalysis(summaries);
    }

    private ResponseQualityReport AnalyzeQuality(List<ResponseRecord> responses)
    {
        var likertIds = new HashSet<string>(_likertItems.Select(i => i.Id));
        var forcedPrefixes = new HashSet<string>(_forcedChoiceItems.Select(i => i.Id));

        var respondentSummaries = new List<RespondentQuality>();

        foreach (var group in responses.GroupBy(r => r.RespondentId))
        {
            var likertValues = group.Where(r => likertIds.Contains(r.ItemId)).Select(r => r.Value).ToList();
            var fcValues = group.Where(r => forcedPrefixes.Any(prefix => r.ItemId.StartsWith(prefix + "|"))).ToList();
            var times = group.Where(r => r.ResponseTimeMs.HasValue).Select(r => r.ResponseTimeMs!.Value).ToList();
            var confidences = group.Where(r => r.Confidence.HasValue).Select(r => r.Confidence!.Value).ToList();

            var avgTime = times.Count > 0 ? times.Average() : (double?)null;
            var stdTime = times.Count > 1 ? Math.Sqrt(times.Select(t => Math.Pow(t - avgTime!.Value, 2)).Sum() / (times.Count - 1)) : (double?)null;
            var avgConfidence = confidences.Count > 0 ? confidences.Average() : (double?)null;
            var uniqueLikertCount = likertValues.Distinct().Count();

            var straightliner = likertValues.Count >= 10 && uniqueLikertCount <= 2;
            var fastResponder = avgTime.HasValue && avgTime < 1500;
            var lowConfidence = avgConfidence.HasValue && avgConfidence < 0.4;

            respondentSummaries.Add(new RespondentQuality(
                group.Key,
                likertValues.Count,
                uniqueLikertCount,
                fcValues.Count,
                avgTime,
                stdTime,
                avgConfidence,
                straightliner,
                fastResponder,
                lowConfidence));
        }

        var flagged = respondentSummaries.Where(r => r.FlagStraightliner || r.FlagFastResponder || r.FlagLowConfidence).ToList();
        return new ResponseQualityReport(respondentSummaries, flagged);
    }

    private static double? ItemTotalCorrelation(double[] itemValues, List<ResponseRecord> allResponses, string itemId)
    {
        if (itemValues.Length < 3)
        {
            return null;
        }

        var byRespondent = allResponses
            .GroupBy(r => r.RespondentId)
            .ToDictionary(g => g.Key, g => g.Where(r => r.ItemId != itemId).Select(r => r.Value).ToArray());

        var filtered = new List<(double Item, double Total)>();

        foreach (var group in allResponses.Where(r => r.ItemId == itemId).GroupBy(r => r.RespondentId))
        {
            if (!byRespondent.TryGetValue(group.Key, out var totals) || totals.Length == 0)
            {
                continue;
            }

            filtered.Add((group.Average(r => r.Value), totals.Average()));
        }

        if (filtered.Count < 3)
        {
            return null;
        }

        var itemArray = filtered.Select(f => f.Item).ToArray();
        var totalArray = filtered.Select(f => f.Total).ToArray();
        return PearsonCorrelation(itemArray, totalArray);
    }

    private static double? PearsonCorrelation(double[] xs, double[] ys)
    {
        if (xs.Length != ys.Length || xs.Length < 2)
        {
            return null;
        }

        var mx = xs.Average();
        var my = ys.Average();
        double numerator = 0;
        double sumSqX = 0;
        double sumSqY = 0;
        for (var i = 0; i < xs.Length; i++)
        {
            var dx = xs[i] - mx;
            var dy = ys[i] - my;
            numerator += dx * dy;
            sumSqX += dx * dx;
            sumSqY += dy * dy;
        }

        var denominator = Math.Sqrt(sumSqX * sumSqY);
        if (denominator == 0)
        {
            return null;
        }

        return numerator / denominator;
    }

    private static double? CronbachAlpha(double[] itemVariances, int respondentCount)
    {
        var k = itemVariances.Length;
        if (k < 2 || respondentCount < 2)
        {
            return null;
        }

        var totalVariance = itemVariances.Sum();
        if (totalVariance == 0)
        {
            return null;
        }

        var averageVariance = totalVariance / k;
        if (averageVariance == 0)
        {
            return null;
        }

        var alpha = (k / (k - 1.0)) * (1 - (itemVariances.Sum() / (k * averageVariance)));
        return alpha;
    }

    private static double Clamp(double value, double min, double max) => Math.Clamp(value, min, max);

    private static double CalculateTimeMultiplier(double? averageTimeMs)
    {
        if (!averageTimeMs.HasValue || averageTimeMs <= 0)
        {
            return 1.0;
        }

        return averageTimeMs.Value switch
        {
            < 1500 => 0.85,
            < 2500 => 0.93,
            < 4500 => 1.0,
            < 6500 => 1.05,
            _ => 1.1
        };
    }

    private static double CalculateConfidenceMultiplier(double? averageConfidence)
    {
        if (!averageConfidence.HasValue)
        {
            return 1.0;
        }

        return averageConfidence.Value switch
        {
            < 0.3 => 0.8,
            < 0.5 => 0.9,
            < 0.7 => 1.0,
            < 0.85 => 1.05,
            _ => 1.1
        };
    }
}

internal sealed record ItemSummary(
    string ItemId,
    string Axis,
    string Category,
    double Mean,
    double Variance,
    double EffectiveWeight,
    double RecommendedWeight,
    double? ItemTotalCorrelation,
    double? AverageResponseTimeMs,
    double? AverageConfidence);

internal sealed record LikertAnalysis(
    IReadOnlyList<ItemSummary> Items,
    IReadOnlyDictionary<string, double?> CronbachAlpha);

internal sealed record ForcedChoiceAnalysis(IReadOnlyList<ItemSummary> Items);

internal sealed record ScenarioAnalysis(IReadOnlyList<ItemSummary> Items);

internal sealed record ResponseQualityReport(
    IReadOnlyList<RespondentQuality> Respondents,
    IReadOnlyList<RespondentQuality> FlaggedRespondents);

internal sealed record RespondentQuality(
    string RespondentId,
    int LikertResponseCount,
    int LikertUniqueCount,
    int ForcedChoiceCount,
    double? AverageTimeMs,
    double? StdTimeMs,
    double? AverageConfidence,
    bool FlagStraightliner,
    bool FlagFastResponder,
    bool FlagLowConfidence);

internal sealed record AnalysisReport(
    LikertAnalysis Likert,
    ForcedChoiceAnalysis ForcedChoice,
    ScenarioAnalysis Scenario,
    ResponseQualityReport ResponseQuality);

internal static class WeightApplier
{
    public static void Apply(
        double tolerance,
        AnalysisReport report,
        string forcedChoicePath,
        string scenarioPath)
    {
        var forcedUpdated = ApplyToFile(forcedChoicePath, report.ForcedChoice.Items, tolerance);
        var scenarioUpdated = ApplyToFile(scenarioPath, report.Scenario.Items, tolerance);

        Console.WriteLine($"重み適用: Forced-choice {forcedUpdated} 件 / シナリオ {scenarioUpdated} 件を更新しました。");
    }

    private static int ApplyToFile(string path, IReadOnlyList<ItemSummary> summaries, double tolerance)
    {
        if (!File.Exists(path))
        {
            Console.WriteLine($"警告: 重み適用対象ファイルが見つかりません ({path})。");
            return 0;
        }

        var root = JsonNode.Parse(File.ReadAllText(path));
        if (root?["items"] is not JsonArray itemsArray)
        {
            Console.WriteLine($"警告: JSON構造が想定と異なるためスキップしました ({path})。");
            return 0;
        }

        var updated = 0;

        foreach (var summary in summaries)
        {
            var parts = summary.ItemId.Split('|');
            if (parts.Length != 2)
            {
                continue;
            }

            var itemId = parts[0];
            var optionKey = parts[1];

            var itemNode = itemsArray.FirstOrDefault(node => node?["id"]?.GetValue<string>() == itemId) as JsonObject;
            if (itemNode?["options"] is not JsonArray optionsArray)
            {
                continue;
            }

            var optionNode = optionsArray.FirstOrDefault(node => node?["key"]?.GetValue<string>() == optionKey) as JsonObject;
            if (optionNode is null)
            {
                continue;
            }

            if (optionNode["primary"] is not JsonObject primary)
            {
                continue;
            }

            var currentWeight = primary["weight"]?.GetValue<double?>() ?? 1.0;
            if (Math.Abs(currentWeight - summary.RecommendedWeight) < tolerance)
            {
                continue;
            }

            primary["weight"] = summary.RecommendedWeight;
            updated++;
        }

        File.WriteAllText(path, root!.ToJsonString(new JsonSerializerOptions { WriteIndented = true }));
        return updated;
    }
}

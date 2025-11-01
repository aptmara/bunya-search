using System.Linq;
using System.Text.Json;
using System.Text.Json.Nodes;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
        policy.AllowAnyOrigin()
              .AllowAnyHeader()
              .AllowAnyMethod());
});

var app = builder.Build();

app.UseCors();

var dataRoot = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "data"));
var storageRoot = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "storage"));
Directory.CreateDirectory(storageRoot);

JsonNode LoadJson(string fileName)
{
    var path = Path.Combine(dataRoot, fileName);
    if (!File.Exists(path))
    {
        throw new FileNotFoundException($"JSONファイルが見つかりません: {fileName}");
    }

    using var stream = File.OpenRead(path);
    return JsonNode.Parse(stream) ?? throw new InvalidDataException($"JSONの解析に失敗しました: {fileName}");
}

app.MapGet("/api/questions/likert", () =>
{
    var json = LoadJson("questions_likert.json");
    return Results.Json(json);
});

app.MapGet("/api/questions/forced-choice", () =>
{
    var json = LoadJson("questions_forced_choice.json");
    return Results.Json(json);
});

app.MapGet("/api/questions/scenario", () =>
{
    var json = LoadJson("questions_scenario.json");
    return Results.Json(json);
});

app.MapGet("/api/careers", () =>
{
    var json = LoadJson("career_map.json");
    return Results.Json(json);
});

app.MapGet("/api/categories/details", () =>
{
    var json = LoadJson("category_details.json");
    return Results.Json(json);
});

app.MapGet("/api/aptitudes/details", () =>
{
    var json = LoadJson("aptitude_details.json");
    return Results.Json(json);
});

app.MapPost("/api/recommendations", (RecommendationRequest request) =>
{
    var json = LoadJson("aptitude_recommendations.json");
    if (json is not JsonObject root)
    {
        return Results.Problem("Recommendation data is invalid.", statusCode: 500);
    }

    var targets = request.Aptitudes?
        .Where(a => !string.IsNullOrWhiteSpace(a))
        .Select(a => a.Trim())
        .Distinct(StringComparer.Ordinal)
        .ToArray() ?? Array.Empty<string>();

    var items = new List<RecommendationResult>();
    foreach (var aptitude in targets)
    {
        if (root[aptitude] is not JsonObject source)
        {
            continue;
        }

        items.Add(new RecommendationResult(
            aptitude,
            ReadStringArray(source, "majors"),
            ReadStringArray(source, "certifications"),
            ReadStringArray(source, "activities")));
    }

    return Results.Ok(new { items });
});

app.MapPost("/api/responses", async (ResponseSubmission submission) =>
{
    var fileName = $"response-{DateTime.UtcNow:yyyyMMdd-HHmmssfff}.json";
    var path = Path.Combine(storageRoot, "responses");
    Directory.CreateDirectory(path);

    var payload = new StoredResponse(submission, DateTime.UtcNow);
    var json = JsonSerializer.Serialize(payload, new JsonSerializerOptions(JsonSerializerDefaults.Web) { WriteIndented = true });
    await File.WriteAllTextAsync(Path.Combine(path, fileName), json);

    return Results.Created($"/api/responses/{fileName}", new { fileName });
});

app.MapGet("/api/status", () =>
{
    var storageInfo = new DirectoryInfo(storageRoot);
    var responseDir = Path.Combine(storageRoot, "responses");
    var responseCount = Directory.Exists(responseDir)
        ? Directory.GetFiles(responseDir, "*.json").Length
        : 0;

    return Results.Ok(new
    {
        dataPath = dataRoot,
        storagePath = storageRoot,
        responses = responseCount,
        updatedAt = DateTime.UtcNow
    });
});

app.Run();

static string[] ReadStringArray(JsonObject source, string propertyName)
{
    if (source[propertyName] is JsonArray array)
    {
        return array
            .Select(node => node?.GetValue<string>())
            .Where(value => !string.IsNullOrWhiteSpace(value))
            .Select(value => value!.Trim())
            .ToArray();
    }

    return Array.Empty<string>();
}

internal record LikertAnswer(string Id, int Value, double? ResponseTimeMs);
internal record ForcedChoiceAnswer(string Id, string OptionKey, double Confidence, double? ResponseTimeMs);
internal record ScenarioAnswer(string Id, string OptionKey, double? ResponseTimeMs);
internal record ProfileSubmission(string Nickname, string Grade, string Track, string Email);
internal record ResponseSubmission(
    ProfileSubmission Profile,
    IReadOnlyList<LikertAnswer> Likert,
    IReadOnlyList<ForcedChoiceAnswer> ForcedChoice,
    IReadOnlyList<ScenarioAnswer> Scenario,
    IReadOnlyDictionary<string, double>? AxisAverage,
    string? Notes);

internal record StoredResponse(ResponseSubmission Payload, DateTime StoredAtUtc);
internal record RecommendationRequest(IReadOnlyList<string> Aptitudes);
internal record RecommendationResult(string Aptitude, IReadOnlyList<string> Majors, IReadOnlyList<string> Certifications, IReadOnlyList<string> Activities);

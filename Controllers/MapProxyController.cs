using Microsoft.AspNetCore.Mvc;
using System.Net.Http;
using System.Threading.Tasks;

[Route("api/[controller]")]
[ApiController]
public class MapProxyController : ControllerBase
{
    private readonly HttpClient _httpClient;

    public MapProxyController(HttpClient httpClient)
    {
        _httpClient = httpClient;
    }

    [HttpGet]
    public async Task<IActionResult> GetMapImage(string url)
    {
        if (string.IsNullOrEmpty(url))
        {
            return BadRequest("Параметр 'url' не указан.");
        }

        try
        {
            var response = await _httpClient.GetAsync(url);
            if (!response.IsSuccessStatusCode)
            {
                var errorContent = await response.Content.ReadAsStringAsync();
                return BadRequest($"Не удалось загрузить изображение. Код ответа: {response.StatusCode}. Сообщение: {errorContent}");
            }

            var imageBytes = await response.Content.ReadAsByteArrayAsync();
            return File(imageBytes, "image/png");
        }
        catch (Exception ex)
        {
            return BadRequest($"Ошибка при загрузке изображения: {ex.Message}");
        }
    }
}
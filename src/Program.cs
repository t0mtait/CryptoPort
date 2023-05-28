// See https://aka.ms/new-console-template for more information
using System;
using System.Net.Http;
using System.Text.Json;
using System.Threading.Tasks;

namespace cryptoapp
{
    public class Portfolio
    {
        public static void Main(string[] args)
        {
            Console.Write("Initialized CryptoPort v0.1\n\n");
            Console.Write("What would you like to do?\n");
            Console.Write("(1) Check coin information\n");
            Console.Write("(2) Read CryptoPort Documentation\n\n");

            int choice = int.Parse(Console.ReadLine());

            if (choice == 1)
            {
                Checker().Wait();
            }
        }

        public static async Task Checker()
        {
            Console.WriteLine("\n\nInput name of coin");
            string coin = (Console.ReadLine()).ToLower();

            // Create an instance of HttpClient
            using (HttpClient client = new HttpClient())
            {
                // Set the URL of the request
                string url = "https://api.coincap.io/v2/assets/" + coin;

                // Create an instance of HttpRequestMessage with the HTTP method and URL
                HttpRequestMessage request = new HttpRequestMessage(HttpMethod.Get, url);

                // Optionally, set headers for the request
                request.Headers.Add("User-Agent", "MyCurlClient/1.0");

                // Send the request and get the response
                HttpResponseMessage response = await client.SendAsync(request);

                // Read the response content as a string
                string responseBody = await response.Content.ReadAsStringAsync();

                // Save the response as JSON
                using (JsonDocument document = JsonDocument.Parse(responseBody))
                {
                    // Access the JSON data
                    JsonElement root = document.RootElement;
                    JsonElement dataElement = root.GetProperty("data");

                    string id = dataElement.GetProperty("id").GetString();
                    string rank = dataElement.GetProperty("rank").GetString();
                    string marketCap = dataElement.GetProperty("marketCapUsd").GetString();
                    string priceUSD = dataElement.GetProperty("priceUsd").GetString();

                    // Print the data
                    Console.WriteLine($"\n\nID: {id}");
                    Console.WriteLine($"Rank: {rank}");
                    Console.WriteLine($"Market Cap: ${marketCap}");
                    Console.WriteLine($"Price USD: ${priceUSD}\n\n");

                    Console.WriteLine("(1) Check another coin");
                    Console.WriteLine("(2) Return to Main Menu");

                    int choice = int.Parse(Console.ReadLine());
                    if (choice == 1)
                    {
                        await Checker();
                    }
                    else if (choice == 2)
                    {
                        Main(new string[0]);
                    }
                }
            }
        }
    }
}

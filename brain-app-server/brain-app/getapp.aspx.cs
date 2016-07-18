using System;
using System.Web.UI;
using System.IO;

namespace brain_app_server.brain_app
{
    public partial class getapp : Page
    {
        protected void Page_Load(object sender, EventArgs e)
        {
            string filename = Request.Form["filename"] + ".txt";
            string savePath = Server.MapPath("save");
            string examplePath = Server.MapPath("save_examples");
            string json = "";

            try
            {
                if (Request.Form["useSavedExample"] == "true")
                {
                    foreach (string file in Directory.GetFiles(examplePath, "*.txt"))
                    {
                        string newFile = savePath + file.Substring(examplePath.Length);
                        System.Diagnostics.Debug.WriteLine("Moving example file " + file + " to " + newFile);
                        if (!File.Exists(newFile)) File.Copy(file, newFile);
                    }
                    json = File.ReadAllText(examplePath + "\\" + filename);
                }
                else
                {
                    json = File.ReadAllText(savePath + "\\" + filename);
                }
            }
            catch (FileNotFoundException error)
            {
                System.Diagnostics.Debug.WriteLine("Failed to find " + filename + ": " + error.Message);
            }

            Response.Write(json);
        }
    }
}
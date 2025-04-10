Feature: Delete file

Scenario: Deleting a file that doesn't extend another file
Given a file named "File" that doesn't extend another file
When I delete the file
Then I should no longer see the file named "File"

Scenario: Deleting the Sub File
Given the "SubFile" extends the "SuperFile"
When I delete the file named "SubFile"
Then I should no longer see "SubFile"
And "SuperFile" should no longer be extended by "SubFile"

Scenario: Deleting the Super File
Given the "SubFile" extends the "SuperFile"
When I delete the file named "SuperFile"
Then I should no longer see the file named "SuperFile"
And I should see the object tag of "SubFile" as "SubFile"
And "SubFile" should no longer extend "SuperFile"

Scenario: Deleting a file inside the trail should break the object tag trails
Given the files and corresponding object tags:
 | File Name | Object Tag Trail |
 | File1     | File1            |
 | File2     | File1/File2         |
 | File3     | File1/File2/File3      |
 | File4     | File1/File2/File3/File4   |
 | File5     | File1/File2/File3/File4/File5  |
When I delete the file named "File3"
Then the object tag trails should be:
 | File Name | Object Tag Trail |
 | File1     | File1            |
 | File2     | File1/File2      |
 | File4     | File4            |
 | File5     | File4/File5      |
And "File4" should no longer extend "File3"
And "File2" should no longer be extended by "File3"
